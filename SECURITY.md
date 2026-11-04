# Security and privacy

Document contents are processed locally in browser memory. FolioForge has no document upload endpoints, tracking scripts, authentication or durable file storage. Hosting receives normal requests for application assets; it does not receive selected document data.

Files are untrusted. Validation checks extensions, MIME types, signatures, sizes, counts and library decoding. Limits are 50 MiB per file, 150 MiB total input, 500 PDF pages and 32 million decoded image/render pixels. These are practical guardrails, not a guarantee that every device can process a maximum-size job.

PDF.js renders page content without running document JavaScript or exposing document links as active content. The app never evaluates user-provided code or injects document HTML. Metadata viewing is not a malware scan or authenticity assessment. Digital signatures may be invalidated by editing. Encrypted PDFs are unsupported.

Use trusted copies for important work and keep original documents. Browser/native decoders remain a platform security boundary; keep browsers updated. Outputs can contain content inherited from input PDFs. FolioForge is not a PDF sanitizer.

Report vulnerabilities privately through the repository owner's GitHub profile, without attaching private documents or credentials. Include a minimal synthetic reproduction, browser version, affected tool and expected behavior. Do not file sensitive examples in public issues.

Run `npm audit` and `npm audit --omit=dev` during maintenance. Do not blindly apply major-version audit fixes; validate compatibility and repeat all quality checks.
