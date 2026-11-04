import type { OutputFile } from "./domain";
export async function bundle(files: OutputFile[]) {
  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();
  for (const [index, file] of files.entries())
    zip.file(`${index + 1}-${file.name}`, await file.blob.arrayBuffer());
  return zip.generateAsync({ type: "blob", compression: "STORE" });
}
export function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
