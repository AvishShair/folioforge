import { PDFDocument, StandardFonts, degrees, rgb } from "pdf-lib";
import type {
  ProcessingContext,
  ProcessingResult,
  Settings,
  ToolId,
} from "./domain";
import { limits, pageRanges } from "./validation";

export async function loadPdf(data: ArrayBuffer) {
  const doc = await PDFDocument.load(data, { updateMetadata: false });
  if (!doc.getPageCount()) throw new Error("This PDF has no pages.");
  if (doc.getPageCount() > limits.pages)
    throw new Error(`Maximum ${limits.pages} pages per document.`);
  return doc;
}
export async function processPdf(
  id: ToolId,
  files: File[],
  s: Settings,
  context: ProcessingContext,
): Promise<ProcessingResult> {
  const start = performance.now(),
    outputs: ProcessingResult["files"] = [];
  let outputBytes = 0;
  const save = async (doc: PDFDocument, name: string) => {
    const bytes = await doc.save();
    outputBytes += bytes.byteLength;
    if (outputBytes > limits.totalBytes)
      throw new Error("PDF output exceeds 150 MB. Use fewer pages or files.");
    outputs.push({
      name,
      blob: new Blob([new Uint8Array(bytes)], { type: "application/pdf" }),
      mimeType: "application/pdf",
    });
  };
  const doc = await loadPdf(await files[0].arrayBuffer());
  const selection = [
    ...new Set(pageRanges(s.pages, doc.getPageCount()).flat()),
  ];
  if (id === "merge-pdf") {
    const merged = await PDFDocument.create();
    for (let i = 0; i < files.length; i++) {
      context.signal.throwIfAborted();
      const source =
        i === 0 ? doc : await loadPdf(await files[i].arrayBuffer());
      if (merged.getPageCount() + source.getPageCount() > limits.pages)
        throw new Error("Merged output exceeds 500 pages.");
      const pages = await merged.copyPages(source, source.getPageIndices());
      pages.forEach((p) => merged.addPage(p));
      context.onProgress?.(i + 1, files.length, `Merged ${files[i].name}`);
    }
    await save(merged, "merged.pdf");
  } else if (id === "split-pdf") {
    const groups =
      s.splitMode === "individual"
        ? selection.map((p) => [p])
        : pageRanges(s.pages, doc.getPageCount());
    for (let i = 0; i < groups.length; i++) {
      context.signal.throwIfAborted();
      const part = await PDFDocument.create();
      (await part.copyPages(doc, groups[i])).forEach((p) => part.addPage(p));
      await save(part, `pages-${i + 1}.pdf`);
      context.onProgress?.(i + 1, groups.length, "Extracting pages");
    }
  } else if (id === "organize-pdf") {
    if (
      !s.order.length ||
      s.order.some((i) => i >= doc.getPageCount()) ||
      new Set(s.order).size !== s.order.length
    )
      throw new Error("Keep at least one valid page, without duplicates.");
    const result = await PDFDocument.create();
    (await result.copyPages(doc, s.order)).forEach((p) => result.addPage(p));
    await save(result, "organized.pdf");
  } else if (id === "pdf-metadata") {
    const metadata = {
      title: doc.getTitle() ?? null,
      author: doc.getAuthor() ?? null,
      subject: doc.getSubject() ?? null,
      keywords: doc.getKeywords() ?? null,
      creator: doc.getCreator() ?? null,
      producer: doc.getProducer() ?? null,
      created: doc.getCreationDate()?.toISOString() ?? null,
      modified: doc.getModificationDate()?.toISOString() ?? null,
      pageCount: doc.getPageCount(),
      pages: doc.getPages().map((p, i) => ({
        page: i + 1,
        ...p.getSize(),
        rotation: p.getRotation().angle,
      })),
    };
    return {
      files: [
        {
          name: "metadata.json",
          blob: new Blob([JSON.stringify(metadata, null, 2)], {
            type: "application/json",
          }),
          mimeType: "application/json",
        },
      ],
      warnings: [
        "Metadata inspection is not a security assessment. null means unavailable; an empty string is an explicitly empty value.",
      ],
      metadata,
      durationMs: performance.now() - start,
    };
  } else {
    const font =
      id === "watermark-pdf"
        ? await doc.embedFont(StandardFonts.Helvetica)
        : null;
    if (font && !s.text.trim()) throw new Error("Enter watermark text.");
    for (const i of selection) {
      context.signal.throwIfAborted();
      const page = doc.getPage(i);
      if (id === "rotate-pdf")
        page.setRotation(degrees((page.getRotation().angle + s.angle) % 360));
      if (font) {
        const width = font.widthOfTextAtSize(s.text, s.fontSize),
          rad = (s.watermarkAngle * Math.PI) / 180;
        const x =
          page.getWidth() / 2 -
          (width * Math.cos(rad) - s.fontSize * Math.sin(rad)) / 2;
        const centerY =
          s.position === "top"
            ? page.getHeight() - s.fontSize * 2
            : s.position === "bottom"
              ? s.fontSize * 2
              : page.getHeight() / 2;
        page.drawText(s.text, {
          font,
          size: s.fontSize,
          opacity: s.opacity,
          rotate: degrees(s.watermarkAngle),
          color: rgb(0.25, 0.3, 0.3),
          x,
          y: centerY - (width * Math.sin(rad) + s.fontSize * Math.cos(rad)) / 2,
        });
      }
    }
    await save(doc, id === "rotate-pdf" ? "rotated.pdf" : "watermarked.pdf");
  }
  return {
    files: outputs,
    warnings: [
      "PDF edits may invalidate signatures. Complex forms, bookmarks, and interactive features may not survive page copying.",
    ],
    durationMs: performance.now() - start,
  };
}
