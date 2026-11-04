import { test, expect } from "@playwright/test";
import { PDFDocument } from "pdf-lib";

const fakeGoogle = `
window.google = { accounts: { oauth2: { initTokenClient: options => {
  window.__requestedScopes = options.scope;
  if (options.include_granted_scopes !== false) throw Error('Unexpected incremental scope');
  return { requestAccessToken: () => window.__deny ? options.error_callback() : options.callback({access_token:'mock-access-token',scope:options.scope,expires_in:3600}) };
} } }, picker: {
  DocsView: class { setMimeTypes(types) { window.__pickerTypes = types; return this; } },
  PickerBuilder: class {
    setAppId(value) { return this; } setDeveloperKey(value) { return this; }
    setOAuthToken(value) { return this; } setOrigin(value) { return this; }
    addView(value) { return this; } setCallback(callback) { this.callback = callback; return this; }
    build() { const callback = this.callback; return { dispose() {}, setVisible() { setTimeout(() => callback({action:window.__cancelPicker ? 'cancel' : 'picked',docs:[{id:'original-id',name:'source.pdf'}]}),0); } }; }
  }
} };
`;
for (const viewport of [
  { width: 1440, height: 1000 },
  { width: 390, height: 844 },
]) {
  test(`mocked Drive round trip and guest continuation at ${viewport.width}px`, async ({
    page,
  }) => {
    test.skip(
      process.env.DRIVE_MOCK_TESTS !== "1",
      "Requires a build with synthetic public Drive config; see GOOGLE_DRIVE_SETUP.md.",
    );
    await page.setViewportSize(viewport);
    const doc = await PDFDocument.create();
    doc.addPage([240, 320]);
    const original = Buffer.from(await doc.save());
    let uploaded: Buffer | null = null,
      creates = 0,
      googleScripts = 0;
    const leaks: string[] = [];
    page.on("request", (request) => {
      if (
        new URL(request.url()).hostname === "127.0.0.1" &&
        (request.headers().authorization ||
          request.postData()?.includes("%PDF") ||
          request.url().includes("mock-access-token"))
      )
        leaks.push("Unexpected private data sent to app host");
    });
    await page.route(
      "https://accounts.google.com/gsi/client",
      async (route) => {
        googleScripts++;
        await route.fulfill({
          contentType: "application/javascript",
          body: fakeGoogle,
        });
      },
    );
    await page.route("https://apis.google.com/js/api.js", async (route) => {
      googleScripts++;
      await route.fulfill({
        contentType: "application/javascript",
        body: "window.gapi = {load: (name, options) => options.callback()};",
      });
    });
    await page.route("https://www.googleapis.com/**", async (route) => {
      const req = route.request(),
        url = new URL(req.url());
      const headers = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "*",
        "Access-Control-Expose-Headers": "Location,Range",
      };
      const respond = (body: unknown, status = 200, extra = {}) =>
        route.fulfill({
          status,
          headers: { ...headers, ...extra },
          contentType: "application/json",
          body: JSON.stringify(body),
        });
      if (req.method() === "OPTIONS")
        return route.fulfill({
          status: 204,
          headers: {
            ...headers,
            "Access-Control-Allow-Methods": "GET,POST,PUT,OPTIONS",
          },
        });
      expect(req.headers().authorization).toBe("Bearer mock-access-token");
      if (url.pathname.endsWith("/about"))
        return respond({ user: { permissionId: "account-1" } });
      if (url.pathname.endsWith("/generateIds"))
        return respond({ ids: ["new-output-id"] });
      if (url.pathname.endsWith("/original-id")) {
        if (url.searchParams.get("alt") === "media")
          return route.fulfill({
            headers,
            body: original,
            contentType: "application/pdf",
          });
        return respond({
          name: "source.pdf",
          mimeType: "application/pdf",
          size: original.length,
          capabilities: { canDownload: true },
        });
      }
      if (url.pathname.endsWith("/new-output-id"))
        return respond(
          uploaded ? { id: "new-output-id" } : {},
          uploaded ? 200 : 404,
        );
      if (req.method() === "POST") {
        creates++;
        expect(req.postDataJSON()).toMatchObject({
          id: "new-output-id",
          mimeType: "application/pdf",
        });
        return respond({}, 200, {
          Location:
            "https://www.googleapis.com/upload/drive/v3/files?upload_id=mock",
        });
      }
      if (req.method() === "PUT") {
        if (req.headers()["content-range"].startsWith("bytes */"))
          return route.fulfill({ status: 308, headers });
        uploaded = req.postDataBuffer();
        return respond({ id: "new-output-id" });
      }
      throw new Error("Unexpected mocked Drive request");
    });
    await page.goto("/tools/rotate-pdf");
    await expect(
      page.getByRole("button", { name: "Enable Google Drive" }),
    ).toBeVisible();
    expect(googleScripts).toBe(0);
    await page.getByRole("button", { name: "Enable Google Drive" }).click();
    await page.evaluate(() => {
      (window as unknown as { __deny: boolean }).__deny = true;
    });
    await page
      .getByRole("button", { name: "Connect Google Drive", exact: true })
      .click();
    await expect(
      page.getByRole("alert").filter({ hasText: "closed or blocked" }),
    ).toBeVisible();
    await page.evaluate(() => {
      (window as unknown as { __deny: boolean }).__deny = false;
    });
    await page
      .getByRole("button", { name: "Connect Google Drive", exact: true })
      .click();
    await page.evaluate(() => {
      (window as unknown as { __cancelPicker: boolean }).__cancelPicker = true;
    });
    await page.getByRole("button", { name: "Open from Google Drive" }).click();
    await expect(
      page.getByText("No file selected.", { exact: true }),
    ).toBeVisible();
    await page.evaluate(() => {
      (window as unknown as { __cancelPicker: boolean }).__cancelPicker = false;
    });
    await page.getByRole("button", { name: "Open from Google Drive" }).click();
    await expect(
      page.getByText("Drive download complete.", { exact: false }),
    ).toBeVisible();
    await expect(page.getByText("source.pdf", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: /^Run / }).click();
    await expect(
      page.getByRole("heading", { name: "Your files, freshly forged." }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Save result to Google Drive" })
      .click();
    await expect(
      page.getByRole("link", { name: /View saved output/ }),
    ).toBeVisible();
    expect(uploaded).not.toBeNull();
    const saved = await PDFDocument.load(uploaded!);
    expect(saved.getPageCount()).toBe(1);
    expect(saved.getPage(0).getRotation().angle).toBe(90);
    expect(
      (await PDFDocument.load(original)).getPage(0).getRotation().angle,
    ).toBe(0);
    await page
      .getByRole("button", { name: "Save result to Google Drive" })
      .click();
    await expect(
      page.getByRole("link", { name: /View saved output/ }),
    ).toBeVisible();
    expect(creates).toBe(1);
    expect(
      await page.evaluate(() => ({
        local: localStorage.length,
        session: sessionStorage.length,
      })),
    ).toEqual({ local: 0, session: 0 });
    expect(
      await page.evaluate(
        () =>
          (window as unknown as { __requestedScopes: string })
            .__requestedScopes,
      ),
    ).toBe("https://www.googleapis.com/auth/drive.file");
    expect(
      await page.evaluate(
        () => (window as unknown as { __pickerTypes: string }).__pickerTypes,
      ),
    ).toBe("application/pdf");
    await page.getByRole("button", { name: "Disconnect Google Drive" }).click();
    await expect(
      page.getByText("Disconnected from this workspace.", { exact: false }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Connect Google Drive", exact: true }),
    ).toBeVisible();
    const download = page.waitForEvent("download");
    await page
      .getByRole("button", { name: "Download result", exact: true })
      .click();
    await download;
    await page.getByRole("button", { name: "Reset workspace" }).click();
    await page.getByLabel("Upload files", { exact: true }).setInputFiles({
      name: "guest.pdf",
      mimeType: "application/pdf",
      buffer: original,
    });
    await page.getByRole("button", { name: /^Run / }).click();
    await expect(
      page.getByRole("heading", { name: "Your files, freshly forged." }),
    ).toBeVisible();
    expect(leaks).toEqual([]);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/drive-${viewport.width}.png`,
      fullPage: true,
    });
  });
}

test("unconfigured Drive preserves guest mode and loads no Google assets", async ({
  page,
}) => {
  test.skip(
    process.env.DRIVE_MOCK_TESTS === "1",
    "This check covers builds without Drive configuration.",
  );
  let requests = 0;
  page.on("request", (request) => {
    if (/google\.com|googleapis\.com/.test(request.url())) requests++;
  });
  await page.goto("/tools/rotate-pdf");
  await expect(
    page.getByText("Google Drive is not configured on this deployment.", {
      exact: false,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Choose files", exact: true }),
  ).toBeEnabled();
  expect(requests).toBe(0);
});
