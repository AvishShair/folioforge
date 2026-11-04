import { cp, mkdir } from "node:fs/promises";
await mkdir("public", { recursive: true });
await cp(
  "node_modules/pdfjs-dist/build/pdf.worker.min.mjs",
  "public/pdf.worker.min.mjs",
);
for (const folder of ["cmaps", "standard_fonts", "wasm"])
  await cp(`node_modules/pdfjs-dist/${folder}`, `public/${folder}`, {
    recursive: true,
  });
