import type { Settings, ToolId } from "./domain";
import { dimensions, limits, safeName } from "./validation";
import { checkImageHeader } from "./image-header";
export async function decodeImage(file: Blob) {
  if (typeof createImageBitmap !== "function")
    throw new Error(
      "Image decoding is unavailable. Use a recent Chrome, Edge, Firefox, or Safari browser.",
    );
  await checkImageHeader(file);
  const bitmap = await createImageBitmap(file);
  if (bitmap.width * bitmap.height > limits.pixels) {
    bitmap.close();
    throw new Error("Image exceeds the 32 megapixel limit.");
  }
  return bitmap;
}
export async function encodeCanvas(
  canvas: HTMLCanvasElement,
  mime: string,
  quality: number,
) {
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (b) =>
        b
          ? resolve(b)
          : reject(new Error("Browser could not encode the image.")),
      mime,
      quality,
    ),
  );
  if (blob.type !== mime)
    throw new Error(`This browser does not support ${mime} encoding.`);
  return blob;
}
export async function processImage(id: ToolId, file: File, s: Settings) {
  const bitmap = await decodeImage(file);
  try {
    let sx = 0,
      sy = 0,
      sw = bitmap.width,
      sh = bitmap.height;
    if (id === "crop-image") {
      sx = Math.round((sw * s.cropX) / 100);
      sy = Math.round((sh * s.cropY) / 100);
      sw = Math.min(
        bitmap.width - sx,
        Math.max(1, Math.round((sw * s.cropWidth) / 100)),
      );
      sh = Math.min(
        bitmap.height - sy,
        Math.max(1, Math.round((sh * s.cropHeight) / 100)),
      );
    }
    const size =
      id === "resize-image" || id === "batch-images"
        ? dimensions(sw, sh, s.width, s.height, s.aspect, s.upscale)
        : { width: sw, height: sh };
    const angle = id === "rotate-image" || id === "batch-images" ? s.angle : 0,
      swap = angle === 90 || angle === 270;
    const canvas = document.createElement("canvas");
    canvas.width = swap ? size.height : size.width;
    canvas.height = swap ? size.width : size.height;
    if (canvas.width * canvas.height > limits.pixels)
      throw new Error("Output exceeds 32 megapixels.");
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas is unavailable in this browser.");
    if (s.format === "image/jpeg") {
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    if (id === "enhance-image") {
      if (!("filter" in ctx))
        throw new Error(
          "Image adjustments are not supported by this browser. Try a current Chrome, Edge, or Firefox.",
        );
      ctx.filter = `brightness(${s.brightness}) contrast(${s.contrast}) saturate(${s.saturation})`;
    }
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((angle * Math.PI) / 180);
    if (id === "rotate-image" || id === "batch-images")
      ctx.scale(
        s.flip === "horizontal" ? -1 : 1,
        s.flip === "vertical" ? -1 : 1,
      );
    ctx.drawImage(
      bitmap,
      sx,
      sy,
      sw,
      sh,
      -size.width / 2,
      -size.height / 2,
      size.width,
      size.height,
    );
    const blob = await encodeCanvas(canvas, s.format, s.quality);
    canvas.width = canvas.height = 0;
    return {
      name: safeName(
        file.name,
        s.format.split("/")[1] === "jpeg" ? "jpg" : s.format.split("/")[1],
      ),
      blob,
      mimeType: s.format,
      originalBytes: file.size,
    };
  } finally {
    bitmap.close();
  }
}
