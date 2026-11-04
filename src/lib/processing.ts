import {
  settingsSchema,
  tools,
  type ProcessingContext,
  type ProcessingResult,
  type Settings,
  type ToolId,
} from "./domain";
import { limits, normalizeError, validateFile } from "./validation";
import type { PdfResponse } from "./worker-contract";
export async function processFiles(
  id: ToolId,
  files: File[],
  settings: Settings,
  context: ProcessingContext,
): Promise<ProcessingResult> {
  const start = performance.now(),
    tool = tools.find((t) => t.id === id)!;
  const s = settingsSchema.parse(settings);
  if (files.length < tool.minFiles || files.length > tool.maxFiles)
    throw new Error(`Choose ${tool.minFiles} to ${tool.maxFiles} files.`);
  if (files.reduce((n, f) => n + f.size, 0) > limits.totalBytes)
    throw new Error("Combined inputs must be under 150 MB.");
  for (const file of files) {
    context.signal.throwIfAborted();
    await validateFile(file, tool.input);
  }
  if (tool.input === "pdf" && id !== "pdf-to-images") {
    if (typeof Worker !== "function")
      throw new Error(
        "Web Workers are unavailable. Enable them or use a recent browser.",
      );
    context.signal.throwIfAborted();
    return new Promise((resolve, reject) => {
      const worker = new Worker(new URL("./pdf.worker.ts", import.meta.url));
      const cleanup = () => {
        worker.terminate();
        context.signal.removeEventListener("abort", abort);
      };
      const abort = () => {
        cleanup();
        reject(new DOMException("Processing cancelled.", "AbortError"));
      };
      context.signal.addEventListener("abort", abort, { once: true });
      worker.onerror = () => {
        cleanup();
        reject(new Error("The PDF worker stopped. Try a smaller document."));
      };
      worker.onmessageerror = () => {
        cleanup();
        reject(new Error("Could not read the PDF worker response."));
      };
      worker.onmessage = (event: MessageEvent<PdfResponse>) => {
        const data = event.data;
        if (data.type === "progress")
          context.onProgress?.(data.completed, data.total, data.message);
        else {
          cleanup();
          if (data.type === "success") resolve(data.result);
          else reject(new Error(data.message));
        }
      };
      worker.postMessage({ id, files, settings: s });
    });
  }
  if (id === "pdf-to-images") {
    const { renderPdf } = await import("./render");
    return {
      files: await renderPdf(files[0], s, context),
      warnings: [],
      durationMs: performance.now() - start,
    };
  }
  if (id === "images-to-pdf") {
    const { PDFDocument, PageSizes } = await import("pdf-lib");
    const { decodeImage, encodeCanvas } = await import("./image");
    const doc = await PDFDocument.create();
    for (let i = 0; i < files.length; i++) {
      context.signal.throwIfAborted();
      const bitmap = await decodeImage(files[i]);
      try {
        const canvas = document.createElement("canvas");
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(bitmap, 0, 0);
        const blob = await encodeCanvas(canvas, "image/png", 1);
        const image = await doc.embedPng(await blob.arrayBuffer());
        let [w, h] =
          s.paper === "fit"
            ? [bitmap.width + 2 * s.margin, bitmap.height + 2 * s.margin]
            : s.paper === "a4"
              ? PageSizes.A4
              : PageSizes.Letter;
        if (s.landscape && w < h) [w, h] = [h, w];
        const page = doc.addPage([w, h]);
        const ratio = Math.min(
          (w - 2 * s.margin) / image.width,
          (h - 2 * s.margin) / image.height,
        );
        page.drawImage(image, {
          x: (w - image.width * ratio) / 2,
          y: (h - image.height * ratio) / 2,
          width: image.width * ratio,
          height: image.height * ratio,
        });
        canvas.width = canvas.height = 0;
      } finally {
        bitmap.close();
      }
      context.onProgress?.(i + 1, files.length, "Adding images");
    }
    const bytes = new Uint8Array(await doc.save());
    if (bytes.byteLength > limits.totalBytes)
      throw new Error("Output exceeds 150 MB. Use fewer images.");
    return {
      files: [
        {
          name: "images.pdf",
          blob: new Blob([bytes], {
            type: "application/pdf",
          }),
          mimeType: "application/pdf",
        },
      ],
      warnings: [],
      durationMs: performance.now() - start,
    };
  }
  const { processImage } = await import("./image");
  const result: ProcessingResult = { files: [], warnings: [], durationMs: 0 };
  let bytes = 0;
  for (let i = 0; i < files.length; i++) {
    context.signal.throwIfAborted();
    try {
      const output = await processImage(id, files[i], s);
      if (bytes + output.blob.size > limits.totalBytes)
        throw new Error("Combined output exceeds 150 MB.");
      bytes += output.blob.size;
      output.name = `${i + 1}-${output.name}`;
      result.files.push(output);
    } catch (e) {
      result.warnings.push(`${files[i].name}: ${normalizeError(e)}`);
    }
    context.onProgress?.(i + 1, files.length, `Processed ${files[i].name}`);
    await new Promise((r) => setTimeout(r, 0));
  }
  if (!result.files.length) throw new Error(result.warnings.join("\n"));
  result.durationMs = performance.now() - start;
  return result;
}
