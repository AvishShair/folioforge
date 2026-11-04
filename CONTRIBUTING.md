# Contributing

Use Node.js 24 LTS or newer and npm. Run `npm ci`, then `npm run dev`.

Make a focused branch and keep changes scoped. New tools require a registry entry, validation, honest capability/limitation copy and real output tests. Never upload documents or log their contents. Keep CPU-heavy algorithms out of React components.

Before opening a pull request, run:

```sh
npm run typecheck
npm run lint
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

Browser tests generate synthetic PDFs and images in memory. Test malformed inputs, reset/cancellation, mobile layouts and keyboard alternatives. Reopen/decode generated files rather than only asserting Blob existence. Document changes in behavior and remaining limitations.

Commit the npm lockfile when dependencies change. Generated PDF.js assets are copied by predev/prebuild and intentionally ignored. Do not commit `.env.local`, deployment credentials, private documents, browser traces containing real files or `node_modules`.
