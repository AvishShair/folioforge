import { limits, pageRanges } from "./validation";
import type { ProcessingContext, Settings } from "./domain";
import { encodeCanvas } from "./image";
export async function openRenderer(file: File, signal?: AbortSignal) {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  const data = await file.arrayBuffer();
  signal?.throwIfAborted();
  const task = pdfjs.getDocument({
    data,
    cMapUrl: "/cmaps/",
    cMapPacked: true,
    standardFontDataUrl: "/standard_fonts/",
    wasmUrl: "/wasm/",
  });
  const abort = () => {
    void task.destroy();
  };
  signal?.addEventListener("abort", abort, { once: true });
  try {
    const doc = await task.promise;
    signal?.throwIfAborted();
    if (doc.numPages > limits.pages) throw new Error("Maximum 500 PDF pages.");
    return doc;
  } catch (e) {
    await task.destroy();
    throw e;
  } finally {
    signal?.removeEventListener("abort", abort);
  }
}
export async function renderPdf(
  file: File,
  s: Settings,
  ctx: ProcessingContext,
) {
  const doc = await openRenderer(file, ctx.signal),
    files = [];
  const abort = () => {
    void doc.loadingTask.destroy();
  };
  ctx.signal.addEventListener("abort", abort, { once: true });
  try {
    const pages = [...new Set(pageRanges(s.pages, doc.numPages).flat())];
    let bytes = 0;
    for (const index of pages) {
      ctx.signal.throwIfAborted();
      const page = await doc.getPage(index + 1),
        viewport = page.getViewport({ scale: s.scale });
      if (viewport.width * viewport.height > limits.pixels)
        throw new Error(
          "Rendered page exceeds 32 megapixels. Lower the scale.",
        );
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      await page.render({ canvas, viewport, background: "#ffffff" }).promise;
      const mime = s.format === "image/jpeg" ? "image/jpeg" : "image/png",
        blob = await encodeCanvas(canvas, mime, s.quality);
      bytes += blob.size;
      if (bytes > limits.totalBytes)
        throw new Error("Output exceeds 150 MB. Export fewer pages.");
      files.push({
        name: `page-${index + 1}.${mime === "image/jpeg" ? "jpg" : "png"}`,
        blob,
        mimeType: mime,
      });
      canvas.width = canvas.height = 0;
      page.cleanup();
      ctx.onProgress?.(files.length, pages.length, "Rendering pages");
    }
    return files;
  } finally {
    ctx.signal.removeEventListener("abort", abort);
    await doc.loadingTask.destroy();
  }
}
