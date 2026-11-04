export const limits = {
  fileBytes: 50 * 1024 * 1024,
  totalBytes: 150 * 1024 * 1024,
  pixels: 32_000_000,
  pages: 500,
};
export function pageRanges(value: string, count: number): number[][] {
  if (!count) throw new Error("This PDF has no pages.");
  if (!value.trim()) return [Array.from({ length: count }, (_, i) => i)];
  return value.split(",").map((part) => {
    const match = part.trim().match(/^(\d+)(?:\s*-\s*(\d+))?$/);
    if (!match) throw new Error("Use page ranges such as 1-3, 5, 8-10.");
    const start = Number(match[1]),
      end = Number(match[2] || match[1]);
    if (start < 1 || end < start || end > count)
      throw new Error(
        `Pages must be between 1 and ${count}, in ascending ranges.`,
      );
    return Array.from({ length: end - start + 1 }, (_, i) => start + i - 1);
  });
}
export function safeName(name: string, extension: string) {
  return (
    (name
      .replace(/\.[^.]+$/, "")
      .replace(/[^a-zA-Z0-9_-]/g, "_")
      .slice(0, 80) || "folioforge") +
    "." +
    extension
  );
}
export function sizeChange(before: number, after: number) {
  return before ? ((before - after) / before) * 100 : 0;
}
export function dimensions(
  w: number,
  h: number,
  targetW: number,
  targetH: number,
  aspect = true,
  upscale = false,
) {
  if ([w, h, targetW, targetH].some((n) => !Number.isFinite(n) || n <= 0))
    throw new Error("Dimensions must be positive numbers.");
  if (aspect) {
    const ratio = Math.min(targetW / w, targetH / h, upscale ? Infinity : 1);
    return {
      width: Math.max(1, Math.round(w * ratio)),
      height: Math.max(1, Math.round(h * ratio)),
    };
  }
  return {
    width: upscale ? targetW : Math.min(w, targetW),
    height: upscale ? targetH : Math.min(h, targetH),
  };
}
export function normalizeError(error: unknown): string {
  const message =
    error instanceof Error
      ? error.message
      : "Processing failed. Try a smaller file or another browser.";
  if (/encrypt|password/i.test(message))
    return "Password-protected PDFs are not supported. Unlock a copy before using it here.";
  if (/memory|allocation/i.test(message))
    return "Your browser ran out of memory. Try fewer files or a smaller render scale.";
  return message;
}
export async function validateFile(file: File, kind: "pdf" | "image") {
  if (!file.size) throw new Error(`${file.name}: file is empty.`);
  if (file.size > limits.fileBytes)
    throw new Error(`${file.name}: maximum file size is 50 MB.`);
  const bytes = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const text = new TextDecoder().decode(bytes);
  const format = text.startsWith("%PDF-")
    ? "pdf"
    : bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
      ? "jpeg"
      : bytes.slice(0, 8).join(",") === "137,80,78,71,13,10,26,10"
        ? "png"
        : text.startsWith("RIFF") && text.slice(8, 12) === "WEBP"
          ? "webp"
          : null;
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (
    !format ||
    (kind === "pdf" ? format !== "pdf" : format === "pdf") ||
    !(format === "jpeg" ? ["jpg", "jpeg"] : [format]).includes(extension || "")
  )
    throw new Error(
      `${file.name}: extension and file signature must match a supported ${kind} format.`,
    );
  const mime = format === "pdf" ? "application/pdf" : `image/${format}`;
  if (
    file.type &&
    file.type !== "application/octet-stream" &&
    file.type !== mime
  )
    throw new Error(`${file.name}: MIME type does not match file contents.`);
}
