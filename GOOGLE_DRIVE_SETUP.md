# Google Drive bring-your-own storage

The implementation is optional and browser-only. No FolioForge account, database, service account, OAuth client secret, refresh token, or server upload route is needed. Without all three public environment variables, the Drive panel explains that it is unavailable; guest tools still work. **Real OAuth and Picker acceptance testing has not been performed: the operator chose to configure Google Cloud afterward.** Mocked tests are not evidence that your Cloud project, consent screen, API key restrictions, or live Google permissions are configured correctly.

## 1. Google Cloud project and APIs

Create a dedicated project in [Google Cloud Console](https://console.cloud.google.com/). Enable **Google Drive API** and **Google Picker API** in APIs & Services → Library. Use this same project for the OAuth client, Picker API key, and project number. Copy the numeric **project number** from project settings; the project ID string is not the Picker app ID.

Configure Google Auth Platform (also accessible through OAuth consent screen): Branding → app name FolioForge, monitored support/developer contact emails, homepage, and privacy policy. The app provides `/privacy`, linked from its footer. Review this policy against the actual deployment and add your operator contact before publication. Use the production HTTPS homepage and `/privacy` URL. Add domains you own as authorized domains and complete ownership verification where required. For public verification, use a custom domain you control rather than assuming you can verify the shared `vercel.app` parent domain.

Set Audience to **External** for public Google accounts, or Internal only if you intentionally restrict use to your Workspace organization. Start in **Testing**, and explicitly add each real tester's Google account under Test users. Configure Data Access with only:

```
https://www.googleapis.com/auth/drive.file
```

Do not add full-Drive, readonly full-Drive, metadata-wide, Gmail, identity/profile, or restricted scopes. The app sets `include_granted_scopes: false` and verifies the granted file scope. Existing authorizations from an older client/project may need to be removed in Google Account connections before testing scope changes.

## 2. Web OAuth client

Create an OAuth client of type **Web application**. Add exact Authorized JavaScript origins (scheme, hostname, and port; no path, wildcard, or trailing slash):

```
https://folioforge-rose.vercel.app
http://localhost:3000
http://127.0.0.1:3000
```

Use the actual custom production origin if different. Add a stable preview origin explicitly if you test there; arbitrary Vercel deployment URLs are not automatically authorized. Prefer a separate testing project/client and keys for development. Google Identity Services uses its browser token popup flow here; no redirect callback endpoint or client secret is used. Never put an OAuth client secret into any `NEXT_PUBLIC_*` variable or repository file. Allow popups on the test origin. Keep the app's current referrer policy; do not introduce `Cross-Origin-Opener-Policy: same-origin` without testing Google popups (Google may require `same-origin-allow-popups` when that header is used).

## 3. Restricted browser Picker key

Create an API key. Set Application restrictions to **Websites / HTTP referrers**, not unrestricted or IP-address restrictions. Allow the app origins with a path wildcard, for example:

```
https://folioforge-rose.vercel.app/*
https://docs.google.com/*
```

For a separate development key add `http://localhost:3000/*` and/or `http://127.0.0.1:3000/*`. The official Picker documentation requires `https://docs.google.com/*` because its iframe makes requests from that origin. Set API restrictions to **Restrict key**, allowing Google Picker API and Google Drive API. Do not broadly allow all Google APIs or all Vercel subdomains. Public browser keys are visible by design; their restrictions and quotas are the protection. Direct Drive REST calls in this implementation use OAuth bearer headers, not the API key.

## 4. Environment and Vercel

Add the following to local `.env.local` for development, or Vercel → folioforge → Settings → Environment Variables for the intended deployment environment:

| Variable                            | Value                                                 |
| ----------------------------------- | ----------------------------------------------------- |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID`      | Web client ID ending in `.apps.googleusercontent.com` |
| `NEXT_PUBLIC_GOOGLE_PROJECT_NUMBER` | Numeric project number, not project ID                |
| `NEXT_PUBLIC_GOOGLE_PICKER_API_KEY` | Browser-restricted Picker API key                     |

All three are public build-time configuration. **Rebuild/redeploy after changing them.** Do not enter test placeholders in Vercel. Keep secrets and `.env.local` out of Git. No Vercel backend configuration or credentials are required. This repository's CI build deliberately uses synthetic public values solely for mocked browser tests; those values are not Vercel production settings.

## 5. Real-account acceptance checklist

Use synthetic, non-sensitive files and record browser/version, origin, date, and pass/fail without tokens, HARs, private filenames, or content. Do not record real OAuth sessions with Playwright traces or send network captures to analytics/logs.

1. In a clean desktop browser and mobile Safari/Chrome, process/download a device PDF before enabling Drive. Confirm no Google scripts or document requests occur. Verify the privacy policy is reachable without signing in.
2. Click **Enable Google Drive**, then **Connect Google Drive**. The first click loads official GIS/Picker; the second calls authorization from a fresh user gesture. Check the consent screen requests access to app-selected/created files only. Decline permission, close/block the popup, and retry; guest functionality must remain usable.
3. Open from Google Drive. Confirm the actual official Picker loads with the expected account. Cancel it, reopen, and select a PDF not previously used with FolioForge. Verify the selected filename appears. Try an image tool with JPEG, PNG, and WebP. Google Docs/Sheets exports are intentionally unavailable. Oversized files and owner-restricted downloads should show an actionable error.
4. Rotate or split the selected PDF locally. Save the resulting PDF. Open the saved file using the success link, verify page count/rotation/content, and verify the original's contents and modification time remain unchanged. New files go into My Drive; no original IDs are used for save operations. Multiple outputs are selected and saved individually.
5. Save a synthetic output over 5 MiB with network throttling. Check progress corresponds to server-acknowledged chunks. Briefly go offline mid-upload and restore networking. Retry must probe/resume instead of duplicating the output. Cancel mid-upload, then retry in the same workspace/account. Repeated Save of the same output should return its existing saved file. A changed/reprocessed Blob is a new output.
6. Expire the token (wait for its lifetime) or revoke FolioForge from [Google Account connections](https://myaccount.google.com/connections). The next operation must explain reconnection; reconnect and retry. Switch accounts and ensure the output is saved into the newly authorized account without reusing another account's upload session. Workspace/admin restrictions may still deny access.
7. Disconnect during selection, download, or upload; work must stop, and device inputs/results must remain usable. Disconnect clears the local connection only. Confirm the app is still listed in Google Account connections until you revoke it there. Removing that authorization should not delete files or sign the user out of Google.
8. Reload/navigate away and back: the app must be disconnected. Confirm application localStorage, sessionStorage, cookies, and IndexedDB contain no app-written tokens or documents. Inspect Drive before repeating saves after reload/disconnect: lost recovery state cannot prove an earlier remote upload did not finish.
9. Inspect request destinations locally: document bytes and bearer headers must go directly to Google APIs only, never the FolioForge origin or analytics. App hosting still receives ordinary page/static-asset requests. Test quota/permission/expired-session failures with the automated mocks rather than exhausting real project quotas.

Do not mark the real-account acceptance complete until these checks pass on the configured deployment. The automated tests cannot validate real consent, Google's iframe/cookie behavior, live CORS headers, account policy, or key restrictions.

## 6. Automated checks

`npm test` includes mocked authorization and Drive API integration tests: the only scope, token expiry/late callbacks, bounded streaming downloads, rejected MIME/size/permissions, chunk alignment, progress, offline status recovery, cancelled retries, expired sessions, API quotas, revoked access, and untrusted session URLs. Existing processing tests validate PDF output separately.

To run the full browser round trip locally in PowerShell without real Google configuration:

```powershell
$env:NEXT_PUBLIC_GOOGLE_CLIENT_ID = 'mocked-client.apps.googleusercontent.com'
$env:NEXT_PUBLIC_GOOGLE_PROJECT_NUMBER = '123456789'
$env:NEXT_PUBLIC_GOOGLE_PICKER_API_KEY = 'mocked-picker-key'
npm run build
$env:DRIVE_MOCK_TESTS = '1'
npm run test:e2e
Remove-Item Env:NEXT_PUBLIC_GOOGLE_CLIENT_ID, Env:NEXT_PUBLIC_GOOGLE_PROJECT_NUMBER, Env:NEXT_PUBLIC_GOOGLE_PICKER_API_KEY, Env:DRIVE_MOCK_TESTS
```

The Playwright tests route GIS, Picker and REST requests to mocks. On desktop and mobile viewports, they download a synthetic Drive PDF, run the actual local PDF engine, inspect the uploaded PDF's rotation, verify original bytes, avoid duplicate saves, disconnect, and continue as guest. These synthetic tests may retain failure traces. Build again with the intended environment before serving/deploying local build artifacts. An unconfigured build runs the no-Google-assets guest check instead. CI runs the configured mock suite without any secrets.

## 7. Public launch and troubleshooting

After testing, change the External app audience to production and complete any Google-requested brand verification. `drive.file` is classified as recommended/non-sensitive; it does not justify requesting broad scopes or a restricted-scope security assessment. Brand/domain verification and OAuth policy compliance still apply. Supply an accurate homepage/privacy policy, owned domains, contacts and demonstration if requested. Testing mode is intended for listed testers, not a public launch; Google applies testing/user/authorization limits. Check the current Console status rather than promising that publication alone implies verification.

- `origin_mismatch` / blocked authorization: verify the exact client, origin, port, audience and test-user entry.
- Invalid developer key / Picker fails: ensure both APIs enabled, project number matches client/key, referrer list includes app and `docs.google.com`, and API restrictions allow Picker.
- 401: token expired/revoked; reconnect through a user click, then retry.
- 403: reselect the file, check consent/admin policies, or free Drive storage if full. Rate-limit reasons are reported separately.
- 429 / rate quota / 5xx / network loss: bounded retries/backoff occur automatically. Retry later if exhausted. Upload Retry probes server state before sending more bytes.
- Session 404: upload is restarted using the same reserved new file ID. After a lost completion response, file lookup avoids another creation.
- Cancellation stops browser requests; it cannot retract a completed upload. No permanent upload-resume state exists on FolioForge servers or browser storage.

Official references, consulted for this implementation:

- [GIS browser token model](https://developers.google.com/identity/oauth2/web/guides/use-token-model)
- [Official web Picker setup and key restrictions](https://developers.google.com/workspace/drive/picker/guides/web-picker)
- [Drive scope selection](https://developers.google.com/workspace/drive/api/guides/api-specific-auth)
- [Resumable uploads and recovery](https://developers.google.com/workspace/drive/api/guides/manage-uploads)
- [Brand verification](https://developers.google.com/identity/protocols/oauth2/production-readiness/brand-verification)
