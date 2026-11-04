export const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";
export type GoogleConfig = {
  clientId: string;
  projectNumber: string;
  apiKey: string;
};
type TokenResponse = {
  access_token?: string;
  expires_in?: number;
  scope?: string;
  error?: string;
};
export interface GoogleSdk {
  accounts: {
    oauth2: {
      initTokenClient(options: {
        client_id: string;
        scope: string;
        include_granted_scopes: boolean;
        callback: (response: TokenResponse) => void;
        error_callback: () => void;
      }): { requestAccessToken(options: { prompt: string }): void };
    };
  };
  picker: {
    DocsView: new () => { setMimeTypes(types: string): unknown };
    PickerBuilder: new () => PickerBuilder;
  };
}
interface PickerBuilder {
  setAppId(id: string): PickerBuilder;
  setDeveloperKey(key: string): PickerBuilder;
  setOAuthToken(token: string): PickerBuilder;
  setOrigin(origin: string): PickerBuilder;
  addView(view: unknown): PickerBuilder;
  setCallback(
    callback: (data: {
      action: string;
      docs?: { id: string; name: string }[];
    }) => void,
  ): PickerBuilder;
  build(): { setVisible(visible: boolean): void; dispose(): void };
}
declare global {
  interface Window {
    google?: GoogleSdk;
    gapi?: {
      load(
        name: string,
        options: {
          callback: () => void;
          onerror: () => void;
          timeout: number;
          ontimeout: () => void;
        },
      ): void;
    };
  }
}
const scripts = new Map<string, Promise<void>>();
function script(src: string) {
  const existing = scripts.get(src);
  if (existing) return existing;
  const pending = new Promise<void>((resolve, reject) => {
    const element = document.createElement("script");
    const timer = setTimeout(fail, 20000);
    function fail() {
      clearTimeout(timer);
      element.remove();
      scripts.delete(src);
      reject(
        new Error(
          "Google could not load. Check your connection or browser content blockers and retry.",
        ),
      );
    }
    element.src = src;
    element.async = true;
    element.onload = () => {
      clearTimeout(timer);
      resolve();
    };
    element.onerror = fail;
    document.head.appendChild(element);
  });
  scripts.set(src, pending);
  return pending;
}
export async function loadGoogle(): Promise<GoogleSdk> {
  await Promise.all([
    script("https://accounts.google.com/gsi/client"),
    script("https://apis.google.com/js/api.js"),
  ]);
  await new Promise<void>((resolve, reject) => {
    const fail = () =>
      reject(new Error("Google Picker could not load. Please retry."));
    if (!window.gapi) return fail();
    window.gapi.load("picker", {
      callback: resolve,
      onerror: fail,
      timeout: 20000,
      ontimeout: fail,
    });
  });
  if (!window.google?.picker || !window.google.accounts)
    throw new Error("Google libraries are unavailable.");
  return window.google;
}

export class GoogleAuthorization {
  private token = "";
  private expires = 0;
  private sdk?: GoogleSdk;
  private pending?: () => void;
  constructor(
    private config: GoogleConfig,
    private loader = loadGoogle,
    private now = Date.now,
  ) {}
  get connected() {
    return !!this.token && this.now() < this.expires;
  }
  async prepare() {
    this.sdk = await this.loader();
  }
  accessToken() {
    if (!this.connected) {
      this.invalidate();
      throw new Error(
        "Google authorization expired or is disconnected. Connect Google Drive again, then retry.",
      );
    }
    return this.token;
  }
  invalidate() {
    this.token = "";
    this.expires = 0;
  }
  disconnect() {
    this.pending?.();
    this.invalidate();
  }
  connect(): Promise<void> {
    if (!this.sdk) return Promise.reject(new Error("Load Google Drive first."));
    this.pending?.();
    this.invalidate();
    const sdk = this.sdk;
    return new Promise((resolve, reject) => {
      let done = false;
      const finish = (error?: string) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        this.pending = undefined;
        if (error) reject(new Error(error));
        else resolve();
      };
      const timer = setTimeout(
        () => finish("Google sign-in timed out. Try connecting again."),
        120000,
      );
      this.pending = () => finish("Google connection cancelled.");
      try {
        const client = sdk.accounts.oauth2.initTokenClient({
          client_id: this.config.clientId,
          scope: DRIVE_SCOPE,
          include_granted_scopes: false,
          callback: (response) => {
            if (done) return;
            if (response.error || !response.access_token)
              return finish(
                "Google authorization was declined. You can continue using files from your device.",
              );
            if (!response.scope?.split(" ").includes(DRIVE_SCOPE))
              return finish(
                "Google Drive file permission was not granted. Connect again and allow access to selected files.",
              );
            if (
              !Number.isFinite(Number(response.expires_in)) ||
              Number(response.expires_in) <= 30
            )
              return finish(
                "Google returned an expired authorization. Connect again.",
              );
            this.token = response.access_token;
            this.expires =
              this.now() + (Number(response.expires_in) - 30) * 1000;
            finish();
          },
          error_callback: () =>
            finish(
              "Google sign-in was closed or blocked. Allow popups for this site and connect again.",
            ),
        });
        client.requestAccessToken({ prompt: "select_account" });
      } catch {
        finish("Google sign-in could not open. Please retry.");
      }
    });
  }
  choose(
    kind: "pdf" | "image",
    signal: AbortSignal,
  ): Promise<{ id: string; name: string } | null> {
    const token = this.accessToken(),
      sdk = this.sdk!;
    signal.throwIfAborted();
    return new Promise((resolve, reject) => {
      const picker = new sdk.picker.PickerBuilder()
        .setAppId(this.config.projectNumber)
        .setDeveloperKey(this.config.apiKey)
        .setOAuthToken(token)
        .setOrigin(window.location.origin)
        .addView(
          new sdk.picker.DocsView().setMimeTypes(
            kind === "pdf"
              ? "application/pdf"
              : "image/jpeg,image/png,image/webp",
          ),
        )
        .setCallback((data) => {
          if (data.action === "picked") {
            cleanup();
            resolve(data.docs?.[0] ?? null);
          } else if (data.action === "cancel") {
            cleanup();
            resolve(null);
          } else if (data.action === "error") {
            cleanup();
            reject(
              new Error(
                "Google Picker failed. Check authorization and project configuration, then retry.",
              ),
            );
          }
        })
        .build();
      const cleanup = () => {
        signal.removeEventListener("abort", abort);
        picker.dispose();
      };
      const abort = () => {
        cleanup();
        reject(new DOMException("Cancelled", "AbortError"));
      };
      signal.addEventListener("abort", abort, { once: true });
      picker.setVisible(true);
    });
  }
}
