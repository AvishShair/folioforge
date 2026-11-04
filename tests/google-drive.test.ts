import { afterEach, describe, expect, it, vi } from "vitest";
import {
  GoogleAuthorization,
  DRIVE_SCOPE,
  type GoogleSdk,
} from "../src/lib/storage/google-sdk";
import { GoogleDriveProvider } from "../src/lib/storage/google-drive";
const config = {
  clientId: "test-client",
  projectNumber: "123",
  apiKey: "test-key",
};
const token = {
  access_token: "synthetic-test-token",
  expires_in: 3600,
  scope: DRIVE_SCOPE,
};
type Options = Parameters<
  GoogleSdk["accounts"]["oauth2"]["initTokenClient"]
>[0];
function authFixture() {
  let options: Options;
  const request = vi.fn(() => options.callback(token));
  const sdk = {
    accounts: {
      oauth2: {
        initTokenClient: vi.fn((value: Options) => {
          options = value;
          return { requestAccessToken: request };
        }),
      },
    },
  } as unknown as GoogleSdk;
  let now = 1000;
  const auth = new GoogleAuthorization(
    config,
    async () => sdk,
    () => now,
  );
  return {
    auth,
    sdk,
    request,
    options: () => options,
    expire: () => {
      now += 3600 * 1000;
    },
  };
}
const json = (data: unknown, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), { status, headers });
const signal = () => new AbortController().signal;
const sessionUrl =
  "https://www.googleapis.com/upload/drive/v3/files?upload_id=synthetic";
const output = (size = 20) => ({
  name: "result.pdf",
  mimeType: "application/pdf",
  blob: new Blob([new Uint8Array(size)]),
});
async function setup(responses: (Response | Error)[]) {
  const fixture = authFixture();
  await fixture.auth.prepare();
  await fixture.auth.connect();
  const fetcher = vi.fn<typeof fetch>(async () => {
    const next = responses.shift();
    if (!next) throw new Error("Unexpected API request");
    if (next instanceof Error) throw next;
    return next;
  });
  const provider = new GoogleDriveProvider(
    fixture.auth,
    fetcher,
    async () => {},
  );
  return { ...fixture, provider, fetcher };
}
const begin = () => [
  json({ user: { permissionId: "account-a" } }),
  json({ ids: ["new-id"] }),
  json({}, 404),
  json({}, 200, { Location: sessionUrl }),
];
const resume = (end?: number) =>
  new Response(null, {
    status: 308,
    headers: end === undefined ? {} : { Range: `bytes=0-${end}` },
  });
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
describe("browser-only Google authorization", () => {
  it("cleans up when GIS initialization throws", async () => {
    const f = authFixture();
    await f.auth.prepare();
    vi.mocked(f.sdk.accounts.oauth2.initTokenClient).mockImplementation(() => {
      throw new Error("SDK unavailable");
    });
    await expect(f.auth.connect()).rejects.toThrow(/could not open/);
    expect(f.auth.connected).toBe(false);
  });
  it.each(["picked", "cancel", "abort"])(
    "configures the official single-file Picker and disposes on %s",
    async (action) => {
      const f = authFixture();
      vi.stubGlobal("window", {
        location: { origin: "https://folioforge.example" },
      });
      let callback: (data: {
        action: string;
        docs?: { id: string; name: string }[];
      }) => void = () => {};
      const dispose = vi.fn(),
        appId = vi.fn(),
        mime = vi.fn();
      class Builder {
        setAppId(value: string) {
          appId(value);
          return this;
        }
        setDeveloperKey(value: string) {
          expect(value).toBe(config.apiKey);
          return this;
        }
        setOAuthToken(value: string) {
          expect(value).toBe(token.access_token);
          return this;
        }
        setOrigin(value: string) {
          expect(value).toBe("https://folioforge.example");
          return this;
        }
        addView() {
          return this;
        }
        setCallback(value: typeof callback) {
          callback = value;
          return this;
        }
        build() {
          return { setVisible: vi.fn(), dispose };
        }
      }
      f.sdk.picker = {
        PickerBuilder: Builder,
        DocsView: class {
          setMimeTypes(value: string) {
            mime(value);
            return this;
          }
        },
      };
      await f.auth.prepare();
      await f.auth.connect();
      const controller = new AbortController();
      const pending = f.auth.choose("image", controller.signal);
      if (action === "abort") {
        controller.abort();
        await expect(pending).rejects.toThrow(/Cancelled/);
      } else {
        callback({ action, docs: [{ id: "selected", name: "x.png" }] });
        expect(await pending).toEqual(
          action === "cancel" ? null : { id: "selected", name: "x.png" },
        );
      }
      expect(dispose).toHaveBeenCalledTimes(1);
      expect(appId).toHaveBeenCalledWith(config.projectNumber);
      expect(mime).toHaveBeenCalledWith("image/jpeg,image/png,image/webp");
    },
  );
  it("requests exactly drive.file, expires in memory, and disconnects", async () => {
    const f = authFixture();
    await f.auth.prepare();
    await f.auth.connect();
    expect(f.options().scope).toBe(DRIVE_SCOPE);
    expect(f.options().include_granted_scopes).toBe(false);
    expect(f.request).toHaveBeenCalledWith({ prompt: "select_account" });
    expect(f.auth.connected).toBe(true);
    f.expire();
    expect(() => f.auth.accessToken()).toThrow(/expired/);
    await f.auth.connect();
    f.auth.disconnect();
    expect(f.auth.connected).toBe(false);
  });
  it("rejects missing permission and blocked popups", async () => {
    const f = authFixture();
    await f.auth.prepare();
    f.request.mockImplementation(() =>
      f.options().callback({ ...token, scope: "" }),
    );
    await expect(f.auth.connect()).rejects.toThrow(/permission/);
    f.request.mockImplementation(() => f.options().error_callback());
    await expect(f.auth.connect()).rejects.toThrow(/blocked/);
    expect(f.auth.connected).toBe(false);
  });
  it("ignores a late OAuth response after disconnect", async () => {
    const f = authFixture();
    await f.auth.prepare();
    f.request.mockImplementation(() => {});
    const pending = f.auth.connect();
    f.auth.disconnect();
    f.options().callback(token);
    await expect(pending).rejects.toThrow(/cancelled/);
    expect(f.auth.connected).toBe(false);
  });
});
describe("Google Drive transport", () => {
  it("resumes after token revocation and reconnection without reserving another ID", async () => {
    const f = await setup([
      ...begin(),
      resume(),
      json({}, 401),
      json({ user: { permissionId: "account-a" } }),
      json({}, 404),
      resume(),
      json({ id: "new-id" }),
    ]);
    const file = output();
    await expect(f.provider.save(file, { signal: signal() })).rejects.toThrow(
      /revoked/,
    );
    await f.provider.connect();
    await f.provider.save(file, { signal: signal() });
    expect(
      f.fetcher.mock.calls.filter(([url]) =>
        String(url).includes("generateIds"),
      ),
    ).toHaveLength(1);
  });
  it("keeps output IDs separate when the Google account changes", async () => {
    const f = await setup([
      ...begin(),
      resume(),
      json({ id: "new-id" }),
      json({ user: { permissionId: "account-b" } }),
      json({ ids: ["other-new-id"] }),
      json({}, 404),
      json({}, 200, { Location: sessionUrl }),
      resume(),
      json({ id: "other-new-id" }),
    ]);
    const file = output();
    await f.provider.save(file, { signal: signal() });
    await f.provider.connect();
    expect((await f.provider.save(file, { signal: signal() })).id).toBe(
      "other-new-id",
    );
    expect(
      f.fetcher.mock.calls.filter(([url]) =>
        String(url).includes("generateIds"),
      ),
    ).toHaveLength(2);
  });
  it("verifies a conflicting reserved ID instead of uploading over it", async () => {
    const responses = begin();
    responses[3] = json({}, 409);
    const f = await setup([...responses, json({ id: "new-id" })]);
    expect((await f.provider.save(output(), { signal: signal() })).id).toBe(
      "new-id",
    );
    expect(
      f.fetcher.mock.calls.some(
        ([, init]) => init?.method === "PATCH" || init?.method === "PUT",
      ),
    ).toBe(false);
  });
  it("downloads and validates selected content directly in memory", async () => {
    const bytes = new TextEncoder().encode("%PDF-1.7\nsynthetic");
    const f = await setup([
      json({
        name: "test.pdf",
        mimeType: "application/pdf",
        size: bytes.length,
      }),
      new Response(bytes),
    ]);
    const progress = vi.fn();
    const file = await f.provider.download(
      { id: "selected/id", name: "ignored" },
      "pdf",
      { signal: signal(), onProgress: progress },
    );
    expect(await file.text()).toContain("%PDF");
    expect(progress).toHaveBeenLastCalledWith(bytes.length, bytes.length);
    expect(f.fetcher.mock.calls[0][0]).toContain("selected%2Fid");
    for (const [url, init] of f.fetcher.mock.calls) {
      expect(String(url)).toMatch(/^https:\/\/www.googleapis.com\/drive\/v3\//);
      expect(init?.credentials).toBe("omit");
      expect(init?.headers).toMatchObject({
        Authorization: `Bearer ${token.access_token}`,
      });
    }
  });
  it.each([
    [
      { name: "x", mimeType: "application/vnd.google-apps.document", size: 5 },
      /supported/,
    ],
    [
      { name: "x.pdf", mimeType: "application/pdf", size: 51 * 1024 * 1024 },
      /50 MB/,
    ],
    [
      {
        name: "x.pdf",
        mimeType: "application/pdf",
        size: 5,
        capabilities: { canDownload: false },
      },
      /does not allow/,
    ],
  ])(
    "rejects unsuitable downloads before reading content",
    async (meta, message) => {
      const f = await setup([json(meta)]);
      await expect(
        f.provider.download({ id: "original", name: "x" }, "pdf", {
          signal: signal(),
        }),
      ).rejects.toThrow(message);
      expect(f.fetcher).toHaveBeenCalledTimes(1);
    },
  );
  it("rejects truncated and oversized streaming responses", async () => {
    for (const size of [5, 30]) {
      const f = await setup([
        json({ name: "x.pdf", mimeType: "application/pdf", size }),
        new Response("%PDF-1.7\ncontent"),
      ]);
      await expect(
        f.provider.download({ id: "original", name: "x" }, "pdf", {
          signal: signal(),
        }),
      ).rejects.toThrow(/changed|incomplete/);
    }
  });
  it("uploads aligned chunks as a NEW file and reports acknowledged progress", async () => {
    const f = await setup([
      ...begin(),
      resume(),
      resume(1048575),
      json({ id: "new-id" }),
    ]);
    const file = output(1048591),
      progress = vi.fn();
    expect(
      await f.provider.save(file, { signal: signal(), onProgress: progress }),
    ).toEqual({ id: "new-id", name: "result.pdf" });
    expect(f.fetcher.mock.calls[3][1]?.method).toBe("POST");
    expect(JSON.parse(f.fetcher.mock.calls[3][1]?.body as string)).toEqual({
      id: "new-id",
      name: "result.pdf",
      mimeType: "application/pdf",
    });
    expect(f.fetcher.mock.calls[5][1]?.headers).toMatchObject({
      "Content-Range": "bytes 0-1048575/1048591",
    });
    expect(f.fetcher.mock.calls[6][1]?.headers).toMatchObject({
      "Content-Range": "bytes 1048576-1048590/1048591",
    });
    expect(progress.mock.calls).toEqual([
      [0, 1048591],
      [1048576, 1048591],
      [1048591, 1048591],
    ]);
  });
  it("probes committed bytes after a lost response before resending", async () => {
    const f = await setup([
      ...begin(),
      resume(),
      new TypeError("offline"),
      resume(1048575),
      json({ id: "new-id" }),
    ]);
    await f.provider.save(output(1048591), { signal: signal() });
    expect(f.fetcher.mock.calls[6][1]?.headers).toMatchObject({
      "Content-Range": "bytes */1048591",
    });
    expect(f.fetcher.mock.calls[7][1]?.headers).toMatchObject({
      "Content-Range": "bytes 1048576-1048590/1048591",
    });
  });
  it("recovers a lost completion response without creating duplicates", async () => {
    const f = await setup([
      ...begin(),
      resume(),
      new TypeError("offline"),
      json({ id: "new-id" }),
    ]);
    await f.provider.save(output(), { signal: signal() });
    expect(
      f.fetcher.mock.calls.filter(([, init]) => init?.method === "POST"),
    ).toHaveLength(1);
  });
  it("retains a cancelled upload for a subsequent Retry", async () => {
    const controller = new AbortController();
    const f = await setup([
      ...begin(),
      resume(),
      json({ user: { permissionId: "account-a" } }),
      json({}, 404),
      resume(),
      json({ id: "new-id" }),
    ]);
    const file = output();
    await expect(
      f.provider.save(file, {
        signal: controller.signal,
        onProgress: () => controller.abort(),
      }),
    ).rejects.toThrow();
    await f.provider.save(file, { signal: signal() });
    expect(
      f.fetcher.mock.calls.filter(([, init]) => init?.method === "POST"),
    ).toHaveLength(1);
  });
  it("restarts an expired session with the SAME reserved new ID", async () => {
    const f = await setup([
      ...begin(),
      json({}, 404),
      json({}, 200, { Location: sessionUrl }),
      resume(),
      json({ id: "new-id" }),
    ]);
    await f.provider.save(output(), { signal: signal() });
    const posts = f.fetcher.mock.calls.filter(
      ([, init]) => init?.method === "POST",
    );
    expect(posts).toHaveLength(2);
    expect(posts[0][1]?.body).toBe(posts[1][1]?.body);
  });
  it("rejects an untrusted session URL before sending any token to it", async () => {
    const responses = begin();
    responses[3] = json({}, 200, { Location: "https://evil.example/upload" });
    const f = await setup(responses);
    await expect(
      f.provider.save(output(), { signal: signal() }),
    ).rejects.toThrow(/invalid upload session/);
    expect(f.fetcher).toHaveBeenCalledTimes(4);
  });
  it.each([
    [401, "", /revoked/],
    [403, "insufficientPermissions", /denied/],
    [403, "storageQuotaExceeded", /storage is full/],
    [429, "", /quota/],
    [403, "rateLimitExceeded", /quota/],
  ])(
    "handles API error %s %s without exposing response contents",
    async (status, reason, message) => {
      const f = await setup(
        Array.from({ length: 3 }, () =>
          json(
            { error: { message: "SECRET-DO-NOT-LOG", errors: [{ reason }] } },
            status,
          ),
        ),
      );
      await expect(
        f.provider.download({ id: "original", name: "x" }, "pdf", {
          signal: signal(),
        }),
      ).rejects.toThrow(message);
      if (status === 401) expect(f.provider.connected).toBe(false);
    },
  );
  it("makes no request after abort or disconnect", async () => {
    const f = await setup([]),
      controller = new AbortController();
    controller.abort();
    await expect(
      f.provider.save(output(), { signal: controller.signal }),
    ).rejects.toThrow();
    f.provider.disconnect();
    await expect(
      f.provider.save(output(), { signal: signal() }),
    ).rejects.toThrow(/disconnected/);
    expect(f.fetcher).not.toHaveBeenCalled();
  });
});
