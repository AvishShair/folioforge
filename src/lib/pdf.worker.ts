import { processPdf } from "./pdf";
import type { PdfRequest, PdfResponse } from "./worker-contract";
const send = (message: PdfResponse) => self.postMessage(message);
self.onmessage = async (event: MessageEvent<PdfRequest>) => {
  try {
    const result = await processPdf(
      event.data.id,
      event.data.files,
      event.data.settings,
      {
        signal: new AbortController().signal,
        onProgress: (completed, total, message) =>
          send({ type: "progress", completed, total, message }),
      },
    );
    send({ type: "success", result });
  } catch (error) {
    send({
      type: "error",
      message:
        error instanceof Error ? error.message : "PDF processing failed.",
    });
  }
};
