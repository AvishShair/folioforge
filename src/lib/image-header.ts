import { limits } from "./validation";
/** Inspect dimensions before asking a native codec to allocate a full bitmap. */
export async function checkImageHeader(file: Blob) {
  const b = new Uint8Array(await file.slice(0, 256 * 1024).arrayBuffer()),
    v = new DataView(b.buffer);
  let width = 0,
    height = 0;
  if (b.length >= 24 && b[0] === 137 && b[1] === 80) {
    width = v.getUint32(16);
    height = v.getUint32(20);
  } else if (
    b.length >= 30 &&
    String.fromCharCode(...b.slice(8, 12)) === "WEBP"
  ) {
    const kind = String.fromCharCode(...b.slice(12, 16));
    if (kind === "VP8X") {
      width = 1 + b[24] + (b[25] << 8) + (b[26] << 16);
      height = 1 + b[27] + (b[28] << 8) + (b[29] << 16);
    } else if (kind === "VP8 ") {
      width = v.getUint16(26, true) & 0x3fff;
      height = v.getUint16(28, true) & 0x3fff;
    } else if (kind === "VP8L" && b[20] === 47) {
      const bits = v.getUint32(21, true);
      width = (bits & 0x3fff) + 1;
      height = ((bits >>> 14) & 0x3fff) + 1;
    }
  } else if (b[0] === 255 && b[1] === 216) {
    let offset = 2;
    while (offset + 8 < b.length) {
      if (b[offset] !== 255) break;
      const marker = b[offset + 1],
        length = v.getUint16(offset + 2);
      if (
        [
          0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd,
          0xce, 0xcf,
        ].includes(marker)
      ) {
        height = v.getUint16(offset + 5);
        width = v.getUint16(offset + 7);
        break;
      }
      if (length < 2) break;
      offset += 2 + length;
    }
  }
  if (width * height > limits.pixels)
    throw new Error("Image exceeds the 32 megapixel limit.");
  // Reject unknown headers rather than allocate an unbounded decoder buffer.
  if (!width || !height)
    throw new Error(
      "Image dimensions could not be read safely. Re-export as a standard JPEG, PNG, or WebP.",
    );
  return { width, height };
}
