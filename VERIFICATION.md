# Verification record

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

Vercel compatibility is established by a successful Next.js production build with browser-only processing and no persistent server filesystem. Vercel CLI was not installed in this environment and no project link was present. No Vercel deployment or production URL has been verified. Import the GitHub repository into an authenticated Vercel account using the README instructions, then run production smoke tests.

GitHub Actions is configured; its remote run must be checked separately from local results.
