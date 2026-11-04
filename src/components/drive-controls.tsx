"use client";
import { useEffect, useRef, useState } from "react";
import { GoogleDriveProvider } from "@/lib/storage/google-drive";
import type { StorageOutput, StorageProvider } from "@/lib/storage/types";
import { Button } from "./ui/button";

const config = {
  clientId: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "",
  projectNumber: process.env.NEXT_PUBLIC_GOOGLE_PROJECT_NUMBER ?? "",
  apiKey: process.env.NEXT_PUBLIC_GOOGLE_PICKER_API_KEY ?? "",
};
const configured = !!(config.clientId && config.projectNumber && config.apiKey);
export function DriveControls({
  kind,
  outputs,
  disabled,
  onImport,
  onBusy,
}: {
  kind: "pdf" | "image";
  outputs: StorageOutput[];
  disabled: boolean;
  onImport: (files: File[], signal: AbortSignal) => Promise<void>;
  onBusy: (busy: boolean) => void;
}) {
  const [provider] = useState<StorageProvider>(() =>
    GoogleDriveProvider.create(config),
  );
  const [ready, setReady] = useState(false),
    [working, setWorking] = useState(false);
  const [message, setMessage] = useState(""),
    [error, setError] = useState("");
  const [progress, setProgress] = useState<[number, number] | null>(null);
  const [selected, setSelected] = useState(0),
    [saved, setSaved] = useState("");
  const [, render] = useState(0);
  const controller = useRef<AbortController | null>(null),
    generation = useRef(0);
  useEffect(() => {
    const lifecycle = generation;
    const timer = setInterval(() => render((value) => value + 1), 30000);
    return () => {
      clearInterval(timer);
      lifecycle.current++;
      controller.current?.abort();
      provider.disconnect();
    };
  }, [provider]);
  const output = outputs[Math.min(selected, Math.max(0, outputs.length - 1))];
  async function perform(
    label: string,
    operation: (signal: AbortSignal) => Promise<string>,
  ) {
    if (working || disabled) return;
    const job = new AbortController(),
      current = ++generation.current;
    controller.current = job;
    setWorking(true);
    onBusy(true);
    setError("");
    setMessage(label);
    setProgress(null);
    setSaved("");
    try {
      const result = await operation(job.signal);
      job.signal.throwIfAborted();
      if (current === generation.current) setMessage(result);
    } catch (error) {
      if (current === generation.current) {
        setMessage("");
        setError(
          job.signal.aborted
            ? "Transfer cancelled. An upload may already have completed in Drive. Retry checks its status while this workspace remains open."
            : error instanceof Error
              ? error.message
              : "Google Drive request failed. Please retry.",
        );
      }
    } finally {
      if (current === generation.current) {
        setWorking(false);
        onBusy(false);
        controller.current = null;
      }
    }
  }
  function disconnect() {
    generation.current++;
    controller.current?.abort();
    controller.current = null;
    provider.disconnect();
    setWorking(false);
    onBusy(false);
    setProgress(null);
    setError("");
    setSaved("");
    setMessage(
      "Disconnected from this workspace. Local files and results remain available. Google authorization has not been revoked.",
    );
  }
  function cancel() {
    generation.current++;
    controller.current?.abort();
    controller.current = null;
    if (!provider.connected) provider.disconnect();
    setWorking(false);
    onBusy(false);
    setProgress(null);
    setMessage("");
    setError(
      "Drive operation cancelled. An upload may already have completed. Retry in this workspace checks its status before sending more data.",
    );
  }
  return (
    <section className="drive-panel" aria-label="Google Drive storage">
      <h2>
        Google Drive <small>Optional storage</small>
      </h2>
      <p>
        Open one PDF or image at a time from Drive, process it on this device,
        and save a new output to your Drive. Document transfers go directly to
        Google.
      </p>
      {!configured ? (
        <p className="muted">
          Google Drive is not configured on this deployment. All device tools
          remain available.
        </p>
      ) : (
        <div className="drive-actions">
          {!ready ? (
            <Button
              variant="outline"
              disabled={working || disabled}
              onClick={() =>
                void perform("Loading Google libraries…", async (signal) => {
                  await provider.prepare();
                  signal.throwIfAborted();
                  setReady(true);
                  return "Google is ready. Connect to choose your account.";
                })
              }
            >
              Enable Google Drive
            </Button>
          ) : !provider.connected ? (
            <Button
              variant="outline"
              disabled={working || disabled}
              onClick={() =>
                void perform("Waiting for Google authorization…", async () => {
                  await provider.connect();
                  return "Google Drive connected for this workspace.";
                })
              }
            >
              Connect Google Drive
            </Button>
          ) : (
            <>
              <Button
                variant="outline"
                disabled={working || disabled}
                onClick={() =>
                  void perform(
                    "Choose a file in Google Picker…",
                    async (signal) => {
                      const file = await provider.choose(kind, signal);
                      if (!file) return "No file selected.";
                      setMessage(
                        "Downloading selected file from Google Drive…",
                      );
                      const input = await provider.download(file, kind, {
                        signal,
                        onProgress: (done, total) => setProgress([done, total]),
                      });
                      signal.throwIfAborted();
                      await onImport([input], signal);
                      return "Drive download complete. Check Your files before processing.";
                    },
                  )
                }
              >
                Open from Google Drive
              </Button>
              {outputs.length > 0 && (
                <>
                  {outputs.length > 1 && (
                    <label>
                      Output to save
                      <select
                        disabled={working || disabled}
                        value={Math.min(selected, outputs.length - 1)}
                        onChange={(event) =>
                          setSelected(Number(event.target.value))
                        }
                      >
                        {outputs.map((file, index) => (
                          <option key={index} value={index}>
                            {file.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  <Button
                    disabled={working || disabled}
                    onClick={() =>
                      void perform(
                        "Saving a new file to Google Drive…",
                        async (signal) => {
                          const result = await provider.save(output, {
                            signal,
                            onProgress: (done, total) =>
                              setProgress([done, total]),
                          });
                          signal.throwIfAborted();
                          setSaved(
                            `https://drive.google.com/file/d/${encodeURIComponent(result.id)}/view`,
                          );
                          return `Saved ${result.name} to Google Drive. Your original was not changed.`;
                        },
                      )
                    }
                  >
                    Save result to Google Drive
                  </Button>
                </>
              )}
            </>
          )}
          {working && (
            <Button variant="outline" onClick={cancel}>
              Cancel Drive operation
            </Button>
          )}
          {ready && (
            <Button variant="ghost" onClick={disconnect}>
              Disconnect Google Drive
            </Button>
          )}
        </div>
      )}
      <div role="status" aria-live="polite">
        {message}
        {working && progress && (
          <>
            <progress
              aria-label="Google Drive transfer progress"
              value={progress[0]}
              max={progress[1]}
            />
            <small>
              {(progress[0] / 1024 / 1024).toFixed(2)} of{" "}
              {(progress[1] / 1024 / 1024).toFixed(2)} MB transferred
            </small>
          </>
        )}
      </div>
      {error && (
        <p role="alert" className="error">
          {error} Use the same Open or Save button to retry.
        </p>
      )}
      {saved && (
        <p>
          <a href={saved} target="_blank" rel="noopener noreferrer">
            View saved output in Google Drive ↗
          </a>
        </p>
      )}
      <details>
        <summary>Privacy, disconnecting, and revoking access</summary>
        <p>
          Connecting loads Google’s scripts. Google receives your sign-in
          activity and files you explicitly open or save. FolioForge’s servers
          receive neither documents nor access tokens. Tokens and resumable
          upload state stay in memory; leaving this tool, reloading, or
          disconnecting clears them. Google stores saved files under its own
          policies; this is not end-to-end encryption.
        </p>
        <p>
          Disconnect stops this workspace’s transfers and forgets its token. It
          does not sign you out of Google, remove local files, delete saved
          Drive outputs, or revoke the app’s permission. To revoke
          authorization, remove FolioForge in{" "}
          <a
            href="https://myaccount.google.com/connections"
            target="_blank"
            rel="noopener noreferrer"
          >
            Google Account connections
          </a>
          . Reconnect afterward only if you want to grant access again.
        </p>
        <p>
          Retry resumes or checks the same output in this workspace and account.
          After leaving or disconnecting, inspect Drive before saving again
          because a previous upload may have completed. New outputs are created
          in My Drive; original files are never overwritten.
        </p>
      </details>
    </section>
  );
}
