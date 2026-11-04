# Extension delivery status

The requested expansion is **not complete**. The user selected browser-only processing and deferred services requiring a backend.

## Implemented in this increment

- English printed-text OCR from JPEG/PNG/WebP and selected scanned PDF pages, exporting UTF-8 text. Tesseract, WASM, and English model assets are served from this site. Document contents remain local; model caching in IndexedDB is disabled.
- Scanned-PDF compression: JPEG rasterization with scale/quality controls and actual byte comparison. It is lossy, removes searchable text/interactivity, and does not guarantee a smaller file.
- Permanent rectangular redaction: render each page, overwrite selected pixel areas, and embed only the resulting raster images into a fresh PDF. Source text, metadata, forms, attachments, and signatures are not copied. All pages lose searchable text and accessibility tags. Coordinates are top-left percentages of the displayed page. Users must inspect output.
- Page numbering, headers and footers with `{page}` and `{total}` placeholders. Latin text, centered in unrotated page coordinates; oversized labels fail instead of silently clipping.
- Image brightness, contrast, and saturation adjustments. Existing resize supports interpolation-based upscaling; neither reconstructs missing detail.

## Still unimplemented browser features

PDF text/image editing, annotations/drawing, form filling/creation, electronic signatures and cryptographic verification, password protection/unlocking, comparison/repair, PDF/A, background removal, AI upscaling, additional image formats, animated images, and saved workflows/history remain unimplemented. Browser-only does not make every item impossible; these require further implementation, dependency/license review, and correctness tests. No placeholder tools are advertised for them.

## Deferred infrastructure-dependent services

High-fidelity Office conversions, other cloud providers, durable shareable links, and a hosted public processing API are deferred under the browser-only decision. No backend, account system, third-party document processor, or file storage was introduced.

## Verification

Strict TypeScript, ESLint, production build, 11 Vitest tests and 10 Playwright workflows pass locally. The new browser tests perform real OCR on synthetic image and scanned-PDF fixtures, decode grayscale output, reopen generated PDFs, verify source metadata/font resources are absent from rasterized output, and render a fully redacted page to confirm black pixels. The four non-OCR additions are exercised at a 375px mobile viewport. Broader cross-browser testing and an independent security review of redaction remain outstanding.

Optional browser-direct Google Drive storage has now been implemented under the later BYOS request. Deployment configuration and real-account acceptance testing remain operator tasks; see GOOGLE_DRIVE_SETUP.md.
