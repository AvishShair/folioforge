import type { ProcessingResult, Settings, ToolId } from "./domain";
export interface PdfRequest {
  id: ToolId;
  files: File[];
  settings: Settings;
}
export type PdfResponse =
  | { type: "progress"; completed: number; total: number; message: string }
  | { type: "success"; result: ProcessingResult }
  | { type: "error"; message: string };
