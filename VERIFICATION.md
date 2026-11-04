# Verification record

## Google Drive integration — 4 November 2026

- Strict TypeScript, ESLint (no warnings), and production builds passed.
- Vitest: 38 tests passed, including 27 new Google authorization/Drive cases.
- Configured synthetic build: 12 Playwright tests passed (10 existing processing/browser workflows plus desktop and 390px mobile Drive round trips). The alternate unconfigured test was deliberately skipped in this build.
- Unconfigured production build: the separate guest-mode test passed, confirming Drive is unavailable and no Google scripts are loaded. The two configured mock tests were deliberately skipped in this build.
- Drive browser tests mock GIS, official Picker interfaces, and Drive REST responses, but use the real local PDF processing engine. They reopen the uploaded PDF to verify rotation, check the original remains unchanged, reject duplicate saves, test popup/Picker cancellation paths, disconnect, download locally, and process another guest file. Mobile layout had no horizontal overflow and its screenshot was visually inspected.
- API tests cover scope restriction, expiry, late authorization callbacks, Picker disposal, MIME/size/stream validation, permission and quota errors, chunk progress, offline recovery/status probes, cancellation/retry, session expiry, 401 reconnect, account switching, reserved-ID conflicts, and rejection of foreign upload URLs. No dependency changes were needed.
- Real Google OAuth/Picker, browser cookie/CORS behavior, restricted key configuration, and public-app verification remain **unverified** until the operator configures Google Cloud and completes [GOOGLE_DRIVE_SETUP.md](GOOGLE_DRIVE_SETUP.md). No real Google credentials were used or deployed. The production feature remains disabled without the three public values.

Earlier verification records follow and describe their respective releases.

Checked locally on 4 November 2026, Windows, Node.js 26.2.0, npm 11.13.0, Chromium 156 via Playwright.

| Check                       | Result                                                               |
| --------------------------- | -------------------------------------------------------------------- |
| TypeScript strict checking  | Passed                                                               |
| ESLint                      | Passed, no warnings                                                  |
| Vitest                      | 11 tests passed                                                      |
| Playwright                  | 8 workflows passed                                                   |
| Next.js production build    | Passed; homepage and all 14 tool pages pre-rendered                  |
| Production dependency audit | 0 vulnerabilities                                                    |
| Full dependency audit       | 16 moderate development-chain findings; no high or critical findings |

Tests reopen generated PDFs to check page counts, ordering and rotation; decode generated images to check size, format and alpha handling; inspect ZIP members; render watermarked output to verify visible centered text; check metadata, invalid inputs, reset, theme switching, navigation, mobile overflow, and partial batch failure. All 14 tools are exercised with real processing through the combined suites. Browser fixtures are generated in memory rather than using private documents.

Desktop light/dark and mobile screenshots were visually inspected. The homepage browser check recorded no uncaught client errors. This is Chromium coverage, not a claim of complete cross-browser or WCAG conformance.

## Local Lighthouse measurement

The production homepage at localhost scored performance 99, accessibility 100, best practices 100 and SEO 100. This single mobile-emulated lab run is not a production Core Web Vitals guarantee. Lighthouse identified approximately 71 KiB of unused JavaScript and 70 ms of potentially render-blocking work. Processing libraries remain dynamically imported; further bundle reduction is a follow-up opportunity.

## Dependency limitation

The full audit reports the minimatch glob-amplification advisory (`GHSA-g3hv-75wg-m249`) through development lint dependencies. npm's proposed automatic fixes downgrade unrelated major tool versions. ESLint 10 was tested but rejected because the installed plugins declare incompatible peers; ESLint 9.39.5 retains a coherent dependency graph, although npm marks it unsupported. Do not treat the development toolchain audit as clean. Upgrade the plugin family together when compatible releases are available. Production dependencies pass `npm audit --omit=dev`.

## Deployment status

Vercel production is live at **https://folioforge-rose.vercel.app**. The cloud build succeeded with Node.js 24, `npm ci`, and `npm run build`. The public homepage returned HTTP 200. All eight Playwright workflows passed against the deployed site, including actual PDF/image operations and decoded downloads, in 29.6 seconds. No uncaught homepage client errors were recorded.

The Vercel project is linked to `AvishShair/folioforge`, production branch `main`. Production `NEXT_PUBLIC_SITE_URL` points to the public domain for sitemap/canonical generation. CLI credentials and project-local OIDC environment files remain ignored and are not committed.

GitHub Actions run https://github.com/AvishShair/folioforge/actions/runs/41820784739 passed all checks on Linux with Node.js 24, including the production build and eight browser workflows.
