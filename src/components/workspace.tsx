"use client";
import { useEffect, useRef, useState } from "react";
import {
  Upload,
  FileText,
  ShieldCheck,
  Download,
  LoaderCircle,
  X,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import {
  tools,
  settingsSchema,
  type Settings,
  type ToolId,
  type ProcessingResult,
} from "@/lib/domain";
import {
  limits,
  normalizeError,
  sizeChange,
  validateFile,
} from "@/lib/validation";
import { Button } from "./ui/button";
import { SettingsPanel } from "./settings";
import { ImagePreview, PdfPreview } from "./previews";
const bytes = (n: number) =>
  n < 1024 * 1024
    ? `${(n / 1024).toFixed(1)} KB`
    : `${(n / 1024 / 1024).toFixed(2)} MB`;
export function Workspace({ id }: { id: ToolId }) {
  const tool = tools.find((t) => t.id === id)!,
    [files, setFiles] = useState<File[]>([]),
    [s, set] = useState<Settings>(() => settingsSchema.parse({})),
    [result, setResult] = useState<ProcessingResult | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [adding, setAdding] = useState(false),
    [status, setStatus] = useState(""),
    [progress, setProgress] = useState<[number, number] | null>(null);
  const input = useRef<HTMLInputElement>(null),
    controller = useRef<AbortController | null>(null),
    generation = useRef(0);
  useEffect(
    () => () => {
      generation.current++;
      controller.current?.abort();
    },
    [],
  );
  async function add(incoming: File[]) {
    if (busy || adding) return;
    setAdding(true);
    setError("");
    setResult(null);
    const current = generation.current;
    try {
      const next = tool.maxFiles === 1 ? incoming : [...files, ...incoming];
      if (next.length > tool.maxFiles)
        throw new Error(`Choose at most ${tool.maxFiles} files.`);
      if (next.reduce((n, f) => n + f.size, 0) > limits.totalBytes)
        throw new Error("Combined inputs must be below 150 MB.");
      for (const file of incoming) await validateFile(file, tool.input);
      let order: number[] = [];
      if (id === "organize-pdf" && next[0]) {
        const { loadPdf } = await import("@/lib/pdf");
        order = (await loadPdf(await next[0].arrayBuffer())).getPageIndices();
      }
      if (current === generation.current) {
        setFiles(next);
        if (id === "organize-pdf") set((v) => ({ ...v, order }));
      }
    } catch (e) {
      setError(normalizeError(e));
    } finally {
      setAdding(false);
      if (input.current) input.current.value = "";
    }
  }
  function move(index: number, delta: number) {
    const next = [...files];
    [next[index], next[index + delta]] = [next[index + delta], next[index]];
    setFiles(next);
    setResult(null);
  }
  function reset() {
    generation.current++;
    controller.current?.abort();
    setFiles([]);
    setResult(null);
    setError("");
    setStatus("");
    setProgress(null);
    set(settingsSchema.parse({}));
    if (input.current) input.current.value = "";
  }
  async function run() {
    setError("");
    setResult(null);
    setBusy(true);
    setProgress(null);
    setStatus("Preparing files…");
    const job = new AbortController();
    controller.current = job;
    try {
      const parsed = settingsSchema.safeParse(s);
      if (!parsed.success)
        throw new Error(
          parsed.error.issues
            .map((i) => `${i.path.join(".")}: ${i.message}`)
            .join("; "),
        );
      const output = await tool.handler(files, parsed.data, {
        signal: job.signal,
        onProgress: (done, total, message) => {
          setProgress([done, total]);
          setStatus(message);
        },
      });
      job.signal.throwIfAborted();
      setResult(output);
      setStatus(
        `Finished ${output.files.length} output${output.files.length === 1 ? "" : "s"}.`,
      );
    } catch (e) {
      setError(
        job.signal.aborted ? "Processing cancelled." : normalizeError(e),
      );
      setStatus("");
    } finally {
      setBusy(false);
      controller.current = null;
    }
  }
  async function saveAll() {
    if (!result) return;
    setBusy(true);
    try {
      const { bundle, download } = await import("@/lib/downloads");
      if (result.files.length === 1)
        download(result.files[0].blob, result.files[0].name);
      else download(await bundle(result.files), "folioforge.zip");
    } catch (e) {
      setError(`Download failed: ${normalizeError(e)}`);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="workspace">
      <section className="files-panel">
        <div className="panel-heading">
          <h2>Your files</h2>
          <span>{files.length} selected</span>
        </div>
        <div
          className="dropzone"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            void add(Array.from(e.dataTransfer.files));
          }}
        >
          <Upload size={30} />
          <h3>Drop your {tool.input === "pdf" ? "PDFs" : "images"} here</h3>
          <p>or choose them from your device</p>
          <Button
            variant="outline"
            disabled={busy || adding}
            onClick={() => input.current?.click()}
          >
            {adding ? "Checking files…" : "Choose files"}
          </Button>
          <input
            ref={input}
            type="file"
            aria-label="Upload files"
            accept={tool.accepted}
            multiple={tool.maxFiles > 1}
            onChange={(e) => void add(Array.from(e.target.files || []))}
            className="sr-only"
          />
          <small>
            {tool.accepted.replaceAll(",", " · ")} · Up to 50 MB each
          </small>
        </div>
        <fieldset disabled={busy || adding} className="file-list">
          {files.map((file, index) => (
            <div
              className="file-item"
              key={`${file.name}-${index}`}
              draggable={files.length > 1 && !busy}
              onDragStart={(e) =>
                e.dataTransfer.setData("text/file", String(index))
              }
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const value = e.dataTransfer.getData("text/file");
                if (!value || busy) return;
                const next = [...files],
                  from = Number(value);
                next.splice(index, 0, next.splice(from, 1)[0]);
                setFiles(next);
                setResult(null);
              }}
            >
              <div className="file-row">
                <FileText size={20} />
                <div>
                  <strong>{file.name}</strong>
                  <small>{bytes(file.size)}</small>
                </div>
                <Button
                  variant="ghost"
                  aria-label={`Move file ${index + 1} up`}
                  disabled={!index}
                  onClick={() => move(index, -1)}
                >
                  <ArrowUp size={16} />
                </Button>
                <Button
                  variant="ghost"
                  aria-label={`Move file ${index + 1} down`}
                  disabled={index === files.length - 1}
                  onClick={() => move(index, 1)}
                >
                  <ArrowDown size={16} />
                </Button>
                <Button
                  variant="ghost"
                  aria-label={`Remove ${file.name}`}
                  onClick={() => {
                    setFiles(files.filter((_, i) => i !== index));
                    setResult(null);
                  }}
                >
                  <X size={16} />
                </Button>
              </div>
              {tool.input === "image" ? (
                <ImagePreview
                  disabled={busy}
                  file={file}
                  crop={id === "crop-image"}
                  s={s}
                  set={(value) => {
                    set(value);
                    setResult(null);
                  }}
                />
              ) : (
                <PdfPreview
                  disabled={busy}
                  file={file}
                  organize={id === "organize-pdf"}
                  order={s.order}
                  onOrder={(order) => {
                    set({ ...s, order });
                    setResult(null);
                  }}
                />
              )}
            </div>
          ))}
        </fieldset>
        <p className="local-note">
          <ShieldCheck size={16} />
          Your files stay on this device.
        </p>
      </section>
      <aside className="settings-panel">
        <h2>Make it your own</h2>
        <fieldset disabled={busy || adding}>
          <SettingsPanel
            id={id}
            s={s}
            set={(value) => {
              set(value);
              setResult(null);
            }}
          />
        </fieldset>
        <Button
          disabled={busy || adding || files.length < tool.minFiles}
          onClick={() => void run()}
        >
          {busy ? <LoaderCircle className="spin" size={18} /> : null}
          {busy ? "Working…" : `Run ${tool.name}`}
        </Button>
        {busy && (
          <Button variant="outline" onClick={() => controller.current?.abort()}>
            Cancel processing
          </Button>
        )}
        <Button variant="ghost" disabled={adding || busy} onClick={reset}>
          Reset workspace
        </Button>
        <div role="status" aria-live="polite">
          {status}
          {progress && busy && (
            <progress
              max={progress[1]}
              value={progress[0]}
              aria-label="Processing progress"
            />
          )}
        </div>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
      </aside>
      {result && (
        <section className="result">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Ready when you are</p>
              <h2>Your files, freshly forged.</h2>
            </div>
            <Button disabled={busy} onClick={() => void saveAll()}>
              <Download size={18} />
              {result.files.length > 1 ? "Download ZIP" : "Download result"}
            </Button>
          </div>
          <p>
            {result.files.length} outputs ·{" "}
            {bytes(result.files.reduce((n, f) => n + f.blob.size, 0))} ·{" "}
            {(result.durationMs / 1000).toFixed(2)} seconds
          </p>
          {tool.input === "image" && id !== "images-to-pdf" && (
            <p>
              Successful inputs:{" "}
              {bytes(
                result.files.reduce((n, f) => n + (f.originalBytes ?? 0), 0),
              )}
              . Size change:{" "}
              {sizeChange(
                result.files.reduce((n, f) => n + (f.originalBytes ?? 0), 0),
                result.files.reduce((n, f) => n + f.blob.size, 0),
              ).toFixed(1)}
              % reduction (negative means an increase).
            </p>
          )}
          <ul>
            {result.files.map((file) => (
              <li key={file.name}>
                {file.name} · {bytes(file.blob.size)} · Success
              </li>
            ))}
          </ul>
          {result.warnings.map((w) => (
            <p className="warning" key={w}>
              {w}
            </p>
          ))}
          {result.metadata && (
            <pre>{JSON.stringify(result.metadata, null, 2)}</pre>
          )}
        </section>
      )}
    </div>
  );
}
