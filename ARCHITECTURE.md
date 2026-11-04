# FolioForge architecture

FolioForge is a modular browser-local monolith. Next.js App Router pre-renders the homepage, informational content, and 20 tool routes. There are no API routes, database, server credentials, or server file-storage services.

## Boundaries

- `src/lib/domain.ts`: tool definitions, settings schema, common processing contracts. Heavy handlers are dynamically imported.
- `src/components`: presentation, uploads, settings, previews, and job state. Algorithms live outside React.
- `src/lib/validation.ts`: count/byte budgets, signatures, extensions, MIME checks, page ranges, sizing and errors.
- `src/lib/processing.ts`: validates a job, selects an engine, reports progress, aggregates batch successes and failures.
- `src/lib/pdf.ts`: pdf-lib PDF operations; invoked in a dedicated worker using `pdf.worker.ts`.
- `src/lib/render.ts`: PDF.js loading and rendering, using same-origin version-matched assets copied at build time.
- `src/lib/image.ts`: native decode, Canvas transformations and encoding.
- `src/lib/downloads.ts`: JSZip export and short-lived download URLs.

## Lifecycle and concurrency

Only one processing job can run in a workspace. PDF editing starts one worker lazily and terminates it on success, failure, cancellation, or unmount. PDF.js owns its parser worker; loading tasks are destroyed after previews/renders. Image processing runs sequentially, yielding between files. Canvas is used on the main thread for broad browser compatibility; cancellation takes effect between native decode/encode operations, which cannot be forcibly interrupted.

Uploads and outputs stay in React state/browser memory. No storage API persists document content. Preview and download Blob URLs are revoked. Reset releases references; unmount cancels work. Actual reclamation is controlled by browser garbage collection.

## Tradeoffs

- Native codecs avoid uploading files but vary across browsers. Unsupported encoding is an error, not a silently relabeled PNG.
- Copying PDF pages preserves dimensions/content/rotation but may discard document-level forms, outlines and signatures. This is editing, not PDF optimization.
- Standard Helvetica watermarks support a limited character set. Unsupported text fails explicitly.
- Simple job state stays local; Zustand holds the shared theme only.
- The checked-in shadcn-style Button uses Radix Slot and class-variance-authority. Native labels, inputs and selects keep settings accessible.
- Webpack is used because the installed Turbopack/Tailwind loader crashed in the local Windows runtime. Both are supported Next.js build paths.
- No enforced CSP is added without deployment testing. Security headers cover MIME sniffing, framing, referrers and unused device permissions.

## Extension contract

Add a typed registry entry, settings validation, a handler producing `ProcessingResult`, controls, help copy and real output tests. Do not add advertised tools before their output is verifiably valid. Avoid putting document libraries into the homepage bundle.

## Storage providers

`src/lib/storage/types.ts` defines the optional `StorageProvider` boundary. Google Drive implements browser authorization, single-file Picker, bounded downloads, and resumable saves; future OneDrive/Dropbox providers can implement the same contract without changing processing engines. `DriveControls` owns the provider for one tool workspace and sends downloaded Files through existing validation. Guest workflows never load Google scripts.

Every save reserves a fresh Drive ID; the provider never receives an original file ID for saving. Upload state is a WeakMap keyed by output Blob and Drive permission ID (no extra identity scope). One-MiB chunks use server-acknowledged progress. Interrupted requests trigger status probes and bounded backoff; Retry checks the reserved ID before resuming, including a lost completion response. Reconnect to a different account gets an independent output ID. No sessions survive disconnect, navigation, or reload. No backend receives tokens, file metadata, or contents.
