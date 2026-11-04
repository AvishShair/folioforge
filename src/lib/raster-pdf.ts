import { PDFDocument } from "pdf-lib";
import { openRenderer } from "./render";
import { encodeCanvas } from "./image";
import { limits, pageRanges } from "./validation";
import type { Settings, ProcessingContext, ProcessingResult } from "./domain";
export async function rasterPdf(
  id: "compress-pdf" | "redact-pdf",
  file: File,
  s: Settings,
  context: ProcessingContext,
): Promise<ProcessingResult> {
  const start = performance.now(),
    source = await openRenderer(file, context.signal),
    output = await PDFDocument.create();
  const abort = () => {
    void source.loadingTask.destroy();
  };
  context.signal.addEventListener("abort", abort, { once: true });
  try {
    const selected = new Set(pageRanges(s.pages, source.numPages).flat());
    let totalBytes = 0;
    for (let index = 0; index < source.numPages; index++) {
      context.signal.throwIfAborted();
      const page = await source.getPage(index + 1),
        original = page.getViewport({ scale: 1 }),
        viewport = page.getViewport({ scale: s.scale });
      if (viewport.width * viewport.height > limits.pixels)
        throw new Error("Page exceeds 32 megapixels. Lower the render scale.");
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      try {
        await page.render({ canvas, viewport, background: "#fff" }).promise;
        if (id === "redact-pdf" && selected.has(index)) {
          const ctx = canvas.getContext("2d")!;
          ctx.fillStyle = "#000";
          const x = Math.floor((canvas.width * s.cropX) / 100),
            y = Math.floor((canvas.height * s.cropY) / 100);
          ctx.fillRect(
            x,
            y,
            Math.ceil((canvas.width * (s.cropX + s.cropWidth)) / 100) - x,
            Math.ceil((canvas.height * (s.cropY + s.cropHeight)) / 100) - y,
          );
        }
        const blob = await encodeCanvas(
          canvas,
          id === "redact-pdf" ? "image/png" : "image/jpeg",
          s.quality,
        );
        totalBytes += blob.size;
        if (totalBytes > limits.totalBytes)
          throw new Error(
            "Output exceeds 150 MB. Use fewer pages or a lower scale.",
          );
        const bytes = await blob.arrayBuffer(),
          image =
            id === "redact-pdf"
              ? await output.embedPng(bytes)
              : await output.embedJpg(bytes);
        output.addPage([original.width, original.height]).drawImage(image, {
          x: 0,
          y: 0,
          width: original.width,
          height: original.height,
        });
      } finally {
        canvas.width = canvas.height = 0;
        page.cleanup();
      }
      context.onProgress?.(index + 1, source.numPages, "Rebuilding pages");
    }
    context.signal.throwIfAborted();
    const bytes = new Uint8Array(await output.save());
    if (bytes.byteLength > limits.totalBytes)
      throw new Error("Output exceeds 150 MB.");
    return {
      files: [
        {
          name: id === "redact-pdf" ? "redacted.pdf" : "compressed.pdf",
          blob: new Blob([bytes], { type: "application/pdf" }),
          mimeType: "application/pdf",
          originalBytes: file.size,
        },
      ],
      warnings: [
        "All pages have been rasterized. Searchable text, interactive elements, signatures, and source metadata were removed. Inspect the result before sharing.",
      ],
      durationMs: performance.now() - start,
    };
  } finally {
    context.signal.removeEventListener("abort", abort);
    await source.loadingTask.destroy();
  }
}
