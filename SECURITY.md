# Security and privacy

Document contents are processed locally in browser memory. FolioForge has no document upload endpoints, analytics, mandatory accounts or durable server file storage. Optional Google authorization is browser-only. Hosting receives normal requests for application assets; it does not receive selected document data.

Files are untrusted. Validation checks extensions, MIME types, signatures, sizes, counts and library decoding. Limits are 50 MiB per file, 150 MiB total input, 500 PDF pages and 32 million decoded image/render pixels. These are practical guardrails, not a guarantee that every device can process a maximum-size job.

PDF.js renders page content without running document JavaScript or exposing document links as active content. The app never evaluates user-provided code or injects document HTML. Metadata viewing is not a malware scan or authenticity assessment. Digital signatures may be invalidated by editing. Encrypted PDFs are unsupported.

Use trusted copies for important work and keep original documents. Browser/native decoders remain a platform security boundary; keep browsers updated. Outputs can contain content inherited from input PDFs. FolioForge is not a PDF sanitizer.

Report vulnerabilities privately through the repository owner's GitHub profile, without attaching private documents or credentials. Include a minimal synthetic reproduction, browser version, affected tool and expected behavior. Do not file sensitive examples in public issues.

Run `npm audit` and `npm audit --omit=dev` during maintenance. Do not blindly apply major-version audit fixes; validate compatibility and repeat all quality checks.

## Optional Google Drive boundary

Google GIS and Picker scripts load only after Enable Google Drive. Only `drive.file` is requested, with incremental scope inclusion disabled. Bearer tokens are kept in the provider instance and attached only to fixed Google API endpoints; upload session origins/paths are validated. No OAuth secrets, refresh tokens, token persistence, proxy routes or document logging exist. The browser must trust the app, its dependencies, and Google scripts; XSS could access in-memory tokens, so do not introduce untrusted HTML or third-party analytics. Google can access files stored on Drive; no end-to-end encryption claim is made.

Disconnect aborts client transfers and forgets tokens/session state, but cannot undo a completed remote upload or revoke authorization. Users can revoke FolioForge at Google Account connections. Reload/navigation also loses resumable state; inspect Drive before repeating a save. Reports and test artifacts must use synthetic fixtures: browser HAR/trace captures with real OAuth can contain tokens and documents, and must never be committed or sent to logging services.
