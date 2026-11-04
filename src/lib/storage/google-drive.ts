import { limits, validateFile } from "../validation";
import { GoogleAuthorization, type GoogleConfig } from "./google-sdk";
import type {
  StorageProvider,
  StorageOutput,
  StoredFile,
  Transfer,
} from "./types";
const API = "https://www.googleapis.com/drive/v3";
const UPLOAD = "https://www.googleapis.com/upload/drive/v3/files";
const CHUNK = 1024 * 1024; // Multiple of Drive's required 256 KiB alignment.
class DriveError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly retryable = false,
  ) {
    super(message);
  }
}
function pause(ms: number, signal: AbortSignal) {
  signal.throwIfAborted();
  return new Promise<void>((resolve, reject) => {
    const abort = () => {
      clearTimeout(timer);
      reject(new DOMException("Cancelled", "AbortError"));
    };
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", abort);
      resolve();
    }, ms);
    signal.addEventListener("abort", abort, { once: true });
  });
}
type Session = { id: string; url?: string; completed?: StoredFile };
export class GoogleDriveProvider implements StorageProvider {
  private sessions = new WeakMap<Blob, Map<string, Session>>();
  constructor(
    private auth: GoogleAuthorization,
    private fetcher: typeof fetch = (input, init) => fetch(input, init),
    private wait = pause,
  ) {}
  static create(config: GoogleConfig) {
    return new GoogleDriveProvider(new GoogleAuthorization(config));
  }
  get connected() {
    return this.auth.connected;
  }
  prepare() {
    return this.auth.prepare();
  }
  connect() {
    return this.auth.connect();
  }
  disconnect() {
    this.auth.disconnect();
    this.sessions = new WeakMap();
  }
  choose(kind: "pdf" | "image", signal: AbortSignal) {
    return this.auth.choose(kind, signal);
  }
  private async request(
    url: string,
    init: RequestInit,
    signal: AbortSignal,
    accepted: number[] = [],
    retry = true,
  ): Promise<Response> {
    for (let attempt = 0; ; attempt++) {
      signal.throwIfAborted();
      try {
        const response = await this.fetcher(url, {
          ...init,
          signal,
          credentials: "omit",
          cache: "no-store",
          referrerPolicy: "no-referrer",
          headers: {
            ...init.headers,
            Authorization: `Bearer ${this.auth.accessToken()}`,
          },
        });
        if (response.ok || accepted.includes(response.status)) return response;
        if (response.status === 401) {
          this.auth.invalidate();
          throw new DriveError(
            "Google access expired or was revoked. Connect Google Drive again, then retry.",
            401,
          );
        }
        const data = await response.json().catch(() => ({}));
        const reasons: string[] = (data.error?.errors ?? []).map(
          (error: { reason?: string }) => error.reason ?? "",
        );
        const quota =
          response.status === 429 ||
          reasons.some((reason) =>
            [
              "rateLimitExceeded",
              "userRateLimitExceeded",
              "dailyLimitExceeded",
            ].includes(reason),
          );
        if (quota)
          throw new DriveError(
            "Google API quota reached. Wait a little, then retry. The project owner may need to check API quotas.",
            response.status,
            true,
          );
        if (response.status === 403)
          throw new DriveError(
            reasons.includes("storageQuotaExceeded")
              ? "Your Google Drive storage is full. Free space and retry."
              : "Google denied access. Select the file again or reconnect and grant file permission. Your organization may restrict downloads.",
            403,
          );
        if (response.status === 404)
          throw new DriveError(
            "This Drive file or upload session is no longer available. Select the file again or retry the upload.",
            404,
          );
        throw new DriveError(
          "Google Drive could not complete this request. Please retry.",
          response.status,
          response.status >= 500,
        );
      } catch (error) {
        signal.throwIfAborted();
        const transient =
          error instanceof TypeError ||
          (error instanceof DriveError && error.retryable);
        if (!retry || !transient || attempt >= 2) {
          if (error instanceof TypeError)
            throw new DriveError(
              "Google Drive connection interrupted. Check your network and retry; uploads resume while this workspace stays open.",
              0,
              true,
            );
          throw error;
        }
        await this.wait(500 * 2 ** attempt, signal);
      }
    }
  }
  async download(
    file: StoredFile,
    kind: "pdf" | "image",
    transfer: Transfer,
  ): Promise<File> {
    const { signal, onProgress } = transfer;
    const url = `${API}/files/${encodeURIComponent(file.id)}`;
    const meta = await (
      await this.request(
        `${url}?fields=name,mimeType,size,capabilities(canDownload)&supportsAllDrives=true`,
        {},
        signal,
      )
    ).json();
    const allowed =
      kind === "pdf"
        ? ["application/pdf"]
        : ["image/jpeg", "image/png", "image/webp"];
    if (!allowed.includes(meta.mimeType))
      throw new Error(
        "Select a supported PDF, JPEG, PNG, or WebP file. Google Docs exports are not supported.",
      );
    if (meta.capabilities?.canDownload === false)
      throw new Error(
        "The owner or your organization does not allow downloading this file.",
      );
    const size = Number(meta.size);
    if (!Number.isSafeInteger(size) || size <= 0 || size > limits.fileBytes)
      throw new Error("Choose a non-empty file up to 50 MB.");
    const response = await this.request(
      `${url}?alt=media&supportsAllDrives=true`,
      {},
      signal,
    );
    const reader = response.body?.getReader();
    if (!reader)
      throw new Error("Your browser could not read the Drive download.");
    const parts: ArrayBuffer[] = [];
    let received = 0;
    try {
      while (true) {
        signal.throwIfAborted();
        const part = await reader.read();
        if (part.done) break;
        received += part.value.byteLength;
        if (received > limits.fileBytes || received > size)
          throw new Error(
            "Drive file changed or exceeds the 50 MB limit. Select it again.",
          );
        parts.push(new Uint8Array(part.value).buffer);
        onProgress?.(received, size);
      }
    } finally {
      await reader.cancel().catch(() => {});
      reader.releaseLock();
    }
    signal.throwIfAborted();
    if (received !== size)
      throw new Error("Drive download was incomplete. Please retry.");
    const result = new File(parts, meta.name, { type: meta.mimeType });
    await validateFile(result, kind);
    return result;
  }
  async save(output: StorageOutput, transfer: Transfer): Promise<StoredFile> {
    const { signal, onProgress } = transfer,
      total = output.blob.size;
    if (!total) throw new Error("Cannot save an empty output.");
    // Namespace retries by Google account, without requesting profile/email scopes.
    const account = await (
      await this.request(`${API}/about?fields=user(permissionId)`, {}, signal)
    ).json();
    const owner = account.user?.permissionId;
    if (typeof owner !== "string" || !owner)
      throw new Error(
        "Could not identify the Drive storage account. Reconnect and retry.",
      );
    let accounts = this.sessions.get(output.blob);
    if (!accounts) {
      accounts = new Map();
      this.sessions.set(output.blob, accounts);
    }
    let session = accounts.get(owner);
    if (!session) {
      const ids = await (
        await this.request(
          `${API}/files/generateIds?count=1&space=drive&type=files`,
          {},
          signal,
        )
      ).json();
      if (typeof ids.ids?.[0] !== "string")
        throw new Error("Google could not reserve an output file. Retry.");
      session = { id: ids.ids[0] };
      accounts.set(owner, session);
    }
    const finish = () => {
      session!.completed = { id: session!.id, name: output.name };
      onProgress?.(total, total);
      return session!.completed;
    };
    if (session.completed) return finish();
    // A lost final response can otherwise produce duplicate files on Retry.
    const existing = await this.request(
      `${API}/files/${encodeURIComponent(session.id)}?fields=id`,
      {},
      signal,
      [404],
    );
    if (existing.ok) return finish();
    for (let restart = 0; restart < 2; restart++) {
      let offset = 0;
      if (!session.url) {
        const response = await this.request(
          `${UPLOAD}?uploadType=resumable&fields=id,name`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json; charset=UTF-8",
              "X-Upload-Content-Type": output.mimeType,
              "X-Upload-Content-Length": String(total),
            },
            body: JSON.stringify({
              id: session.id,
              name: output.name,
              mimeType: output.mimeType,
            }),
          },
          signal,
          [409],
        );
        if (response.status === 409) {
          await this.request(
            `${API}/files/${encodeURIComponent(session.id)}?fields=id`,
            {},
            signal,
          );
          return finish();
        }
        const location = response.headers.get("Location");
        const parsed = location ? new URL(location) : null;
        if (
          !parsed ||
          parsed.origin !== "https://www.googleapis.com" ||
          parsed.pathname !== "/upload/drive/v3/files"
        )
          throw new Error("Google returned an invalid upload session.");
        session.url = parsed.href;
      }
      let probe = true,
        failures = 0;
      while (true) {
        const end = Math.min(offset + CHUNK, total);
        let response: Response;
        try {
          response = await this.request(
            session.url,
            {
              method: "PUT",
              headers: {
                "Content-Type": output.mimeType,
                "Content-Range": probe
                  ? `bytes */${total}`
                  : `bytes ${offset}-${end - 1}/${total}`,
              },
              body: probe ? new Blob([]) : output.blob.slice(offset, end),
            },
            signal,
            [308, 404],
            false,
          );
        } catch (error) {
          if (
            !(error instanceof DriveError) ||
            !error.retryable ||
            failures++ >= 2
          )
            throw error;
          await this.wait(500 * 2 ** failures, signal);
          probe = true;
          continue;
        }
        if (response.status === 404) {
          session.url = undefined;
          break;
        }
        if (response.ok) return finish();
        const range = response.headers.get("Range");
        const match = range?.match(/^bytes=0-(\d+)$/);
        const next = match ? Number(match[1]) + 1 : 0;
        if (
          (range && !match) ||
          next < offset ||
          next > total ||
          next === total
        )
          throw new Error(
            "Google returned unexpected upload progress. Retry to verify the saved file.",
          );
        if (!probe && next === offset) {
          if (failures++ >= 2)
            throw new Error(
              "Google upload stopped making progress. Retry to resume.",
            );
          await this.wait(1000, signal);
        } else if (next > offset) failures = 0;
        offset = next;
        onProgress?.(offset, total);
        probe = false;
      }
    }
    throw new Error(
      "Google upload session expired. Retry to start a new session for this output.",
    );
  }
}
