import { cp, mkdir } from "node:fs/promises";
import { readdir } from "node:fs/promises";
await mkdir("public/ocr/core", { recursive: true });
await cp(
  "node_modules/tesseract.js/dist/worker.min.js",
  "public/ocr/worker.min.js",
);
for (const file of await readdir("node_modules/tesseract.js-core"))
  if (file.endsWith(".wasm") || file.endsWith(".wasm.js"))
    await cp(
      `node_modules/tesseract.js-core/${file}`,
      `public/ocr/core/${file}`,
    );
await cp(
  "node_modules/@tesseract.js-data/eng/4.0.0/eng.traineddata.gz",
  "public/ocr/eng.traineddata.gz",
);
await mkdir("public", { recursive: true });
await cp(
  "node_modules/pdfjs-dist/build/pdf.worker.min.mjs",
  "public/pdf.worker.min.mjs",
);
for (const folder of ["cmaps", "standard_fonts", "wasm"])
  await cp(`node_modules/pdfjs-dist/${folder}`, `public/${folder}`, {
    recursive: true,
  });
