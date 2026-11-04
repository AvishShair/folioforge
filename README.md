# FolioForge

A privacy-first PDF and image workspace. Files are processed in the browser, without accounts, uploads, databases or tracking.

Live application: **https://folioforge-rose.vercel.app**

## Tools

| PDF                                     | Images                                     |
| --------------------------------------- | ------------------------------------------ |
| Merge ordered documents                 | Compress with format/quality controls      |
| Split ranges or individual pages        | Resize with aspect and upscaling controls  |
| Rotate selected pages                   | Convert JPEG, PNG and WebP                 |
| Images to A4, Letter or image-sized PDF | Rotate and flip                            |
| PDF pages to PNG/JPEG                   | Interactive crop with numeric alternatives |
| Text watermarks                         | Batch resize/rotate/convert and ZIP        |
| Visual page organizer                   | Actual input/output size reporting         |
| Metadata and page geometry viewer       | Partial batch success reporting            |

All tools have individual static routes, validation, reset, downloads and local processing feedback. Multiple outputs export as ZIP. Themes, keyboard reordering and responsive layouts are included.

## Stack and architecture

Next.js App Router, React, strict TypeScript, Tailwind CSS, owned shadcn-style/Radix components, Lucide, Zustand and Zod. pdf-lib edits PDFs in a Web Worker; PDF.js renders with same-origin worker and font assets. Canvas/native codecs handle images sequentially; JSZip bundles outputs. Vitest tests pure logic and PDF output; Playwright exercises production-browser workflows and decodes downloaded files.

See [ARCHITECTURE.md](ARCHITECTURE.md) for boundaries, lifecycle and tradeoffs, [SECURITY.md](SECURITY.md) for the trust model and [CONTRIBUTING.md](CONTRIBUTING.md) for changes.

## Local development

Use Node.js 24 LTS or newer and npm. The lockfile pins the tested dependency graph.

```sh
npm ci
npm run dev
```

Open http://localhost:3000. `predev` and `prebuild` copy version-matched PDF.js assets into `public/`; generated assets are ignored by Git. No secrets or configuration are required for processing.

## Checks

```sh
npm run typecheck
npm run lint
npm test
npm run build
npx playwright install chromium
npm run test:e2e
npm audit
npm audit --omit=dev
```

Playwright starts the production server automatically after a build. Tests generate synthetic fixtures in memory and reopen PDF/image/ZIP outputs. GitHub Actions runs installation, types, lint, unit/integration tests, build and Chromium checks on main pushes and pull requests. No CI secrets are needed.

## Production and Vercel

```sh
npm run build
npm start
```

The repository is connected to Vercel project `folioforge` in `avishs-projects-0b8a4aa2`, with production branch `main`, Next.js preset, and Node.js 24. `vercel.json` pins installation to `npm ci` and building to `npm run build`. No filesystem persistence or backend services are required. The build uses supported Webpack because this Windows environment's Turbopack/Tailwind child process crashed.

Set optional `NEXT_PUBLIC_SITE_URL` to the real HTTPS production origin (no trailing slash), then rebuild to enable canonical URLs and the sitemap. `.env.example` contains a local example; no invented production hostname is embedded. Without this setting, sitemap entries and canonical links are omitted.

After deployment, smoke-test a PDF merge and image resize, verify downloaded outputs, and confirm `/pdf.worker.min.mjs` loads. With an authenticated Vercel CLI, `vercel --prod` can deploy from this directory. A local build is not proof of a successful remote deployment.

`NEXT_PUBLIC_SITE_URL` is configured in Vercel Production as `https://folioforge-rose.vercel.app`. To run the same browser suite against a deployed site, set `PLAYWRIGHT_BASE_URL` to its origin before running `npm run test:e2e`; this skips starting a local server. Use synthetic fixtures only. `.vercel/` and `.env.local` are local-only and must not be committed. If CLI login stalls opening a browser on Windows, run it with `CI=1` and manually open its device authorization URL.

## Privacy and limits

Files stay in browser memory and are never stored in localStorage, sessionStorage or IndexedDB. No application code sends selected document contents over the network. Only normal application/static asset requests reach the host. Object URLs, workers and PDF loading tasks are cleaned up after use. Theme selection is in-memory only.

Limits: 30 inputs where batching is supported, 50 MiB per input, 150 MiB total input, 500 PDF pages, and 32 million image/render pixels. Limits are centralized in `src/lib/validation.ts`. Jobs run sequentially to constrain memory; actual device capacity may be lower. Image headers are inspected before full native decoding. Unusual JPEG headers beyond the 256 KiB inspection window must be re-exported.

## Known limitations

- Encrypted PDFs are unsupported. Corrupt documents fail during parsing.
- Page copying can discard forms, outlines and other document-level interactive features. Any edit may invalidate digital signatures. Keep originals.
- Metadata inspection is not security validation. JSON `null` means unavailable; empty strings are preserved.
- Watermarks use standard Helvetica, support Latin text, and position relative to unrotated page coordinates. Long/angled text can extend beyond the page; inspect output before distributing it.
- PNG encoding is lossless; its quality is not controlled by the JPEG/WebP quality setting. Smaller files are not guaranteed.
- JPEG output composites transparency onto white. Animated images export one frame. EXIF/other source metadata is not intentionally preserved.
- Native image encoding and Canvas rendering remain on the main thread for compatibility. Cancel stops between native operations; an in-flight codec call cannot be interrupted.
- Codec behavior and memory limits vary by browser. Automated browser coverage currently targets Chromium; Firefox/Safari require separate validation.
- ZIP packaging needs additional memory and uses STORE to avoid wasting CPU recompressing already-compressed files.
- No Office conversion, PDF-to-Word, OCR, password unlocking or PDF compression is advertised.

## Troubleshooting

If PDF previews fail, rebuild to copy matching assets and clear an old service-worker/browser cache. If encoding fails, try PNG or a recent browser. For memory errors, use fewer pages/files or reduce render scale. A negative reduction percentage means the result became larger. Invalid page ranges must be corrected before processing. Batch failures are reported individually; only successful outputs enter the ZIP.

Dependency audit findings and verified delivery results are recorded in `VERIFICATION.md`. Do not use `npm audit fix --force` without reviewing breaking changes.

## Contributing

Use a feature branch, include tests that decode outputs, preserve privacy boundaries, and run the quality commands before opening a pull request. Report security issues privately as described in SECURITY.md.
