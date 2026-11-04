import { createWorker } from "tesseract.js";
import type { Settings, ProcessingContext, ProcessingResult } from "./domain";
import { decodeImage, encodeCanvas } from "./image";
import { safeName } from "./validation";
function abortable<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const abort = () =>
      reject(new DOMException("Processing cancelled.", "AbortError"));
    signal.addEventListener("abort", abort, { once: true });
    if (signal.aborted) abort();
    promise
      .then(resolve, reject)
      .finally(() => signal.removeEventListener("abort", abort));
  });
}
export async function recognizeText(
  id: "ocr-image" | "ocr-pdf",
  file: File,
  s: Settings,
  context: ProcessingContext,
): Promise<ProcessingResult> {
  const start = performance.now();
  context.signal.throwIfAborted();
  const pending = createWorker("eng", 1, {
    workerPath: "/ocr/worker.min.js",
    corePath: "/ocr/core",
    langPath: "/ocr",
    workerBlobURL: false,
    cacheMethod: "none",
  });
  void pending
    .then((worker) => {
      if (context.signal.aborted) void worker.terminate();
    })
    .catch(() => {});
  const worker = await abortable(pending, context.signal);
  const abort = () => {
    void worker.terminate();
  };
  context.signal.addEventListener("abort", abort, { once: true });
  try {
    let inputs: Blob[];
    if (id === "ocr-pdf")
      inputs = (
        await (
          await import("./render")
        ).renderPdf(file, { ...s, format: "image/png" }, context)
      ).map((f) => f.blob);
    else {
      const bitmap = await decodeImage(file);
      try {
        const c = document.createElement("canvas");
        c.width = bitmap.width;
        c.height = bitmap.height;
        const ctx = c.getContext("2d")!;
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, c.width, c.height);
        ctx.drawImage(bitmap, 0, 0);
        inputs = [await encodeCanvas(c, "image/png", 1)];
        c.width = c.height = 0;
      } finally {
        bitmap.close();
      }
    }
    const pages: string[] = [];
    for (let i = 0; i < inputs.length; i++) {
      context.signal.throwIfAborted();
      const { data } = await abortable(
        worker.recognize(inputs[i]),
        context.signal,
      );
      pages.push(data.text);
      context.onProgress?.(
        i + 1,
        inputs.length,
        "Recognizing printed English text",
      );
    }
    const text = pages.join("\n\n--- Next selected page ---\n\n");
    return {
      files: [
        {
          name: safeName(file.name, "txt"),
          blob: new Blob([text], { type: "text/plain;charset=utf-8" }),
          mimeType: "text/plain",
        },
      ],
      warnings: [
        "English printed text only. OCR can misread characters; proofread the exported text. Layout, handwriting, and searchable PDF output are not supported.",
      ],
      durationMs: performance.now() - start,
    };
  } finally {
    context.signal.removeEventListener("abort", abort);
    await worker.terminate();
  }
}
