"use client";
/* Native images display private, revocable local URLs; Next Image optimization would require uploading them. */
/* eslint-disable @next/next/no-img-element */
import { useEffect, useState } from "react";
import ReactCrop from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import type { Settings } from "@/lib/domain";
import { Button } from "./ui/button";
import { queuePreview } from "@/lib/preview-queue";
import { normalizeError } from "@/lib/validation";
export function ImagePreview({
  file,
  crop,
  s,
  set,
  disabled = false,
}: {
  file: File;
  crop: boolean;
  s: Settings;
  set: (s: Settings) => void;
  disabled?: boolean;
}) {
  const [url, setUrl] = useState(""),
    [ratio, setRatio] = useState<number | undefined>();
  const [imageAspect, setImageAspect] = useState(1);
  useEffect(() => {
    let alive = true,
      local = "";
    void queuePreview(async () => {
      if (!alive) return;
      const { decodeImage } = await import("@/lib/image");
      const image = await decodeImage(file);
      try {
        const canvas = document.createElement("canvas"),
          scale = Math.min(1, 640 / image.width, 480 / image.height);
        canvas.width = Math.round(image.width * scale);
        canvas.height = Math.round(image.height * scale);
        canvas
          .getContext("2d")!
          .drawImage(image, 0, 0, canvas.width, canvas.height);
        const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r));
        if (blob && alive) {
          local = URL.createObjectURL(blob);
          setUrl(local);
          setImageAspect(image.width / image.height);
        }
      } finally {
        image.close();
      }
    }).catch(() => {});
    return () => {
      alive = false;
      if (local) URL.revokeObjectURL(local);
    };
  }, [file]);
  if (!url) return <span className="hint">Preview unavailable or loading</span>;
  if (!crop)
    return (
      <img src={url} className="file-thumb" alt="Selected image preview" />
    );
  return (
    <div className="crop-editor">
      <label>
        Crop preset
        <select
          value={ratio ?? ""}
          onChange={(e) => {
            const value = e.target.value ? Number(e.target.value) : undefined;
            setRatio(value);
            if (value) {
              const width = Math.min(80, (80 * value) / imageAspect);
              const height = (width * imageAspect) / value;
              set({
                ...s,
                cropX: (100 - width) / 2,
                cropY: (100 - height) / 2,
                cropWidth: width,
                cropHeight: height,
              });
            }
          }}
        >
          <option value="">Freeform</option>
          <option value="1">Square</option>
          <option value="1.3333333333">4:3</option>
          <option value="1.7777777778">16:9</option>
        </select>
      </label>
      <ReactCrop
        disabled={disabled}
        crop={{
          unit: "%",
          x: Number(s.cropX),
          y: Number(s.cropY),
          width: Number(s.cropWidth),
          height: Number(s.cropHeight),
        }}
        aspect={ratio}
        onChange={(_, p) =>
          set({
            ...s,
            cropX: p.x,
            cropY: p.y,
            cropWidth: p.width,
            cropHeight: p.height,
          })
        }
      >
        <img src={url} alt="Drag to choose crop area" />
      </ReactCrop>
    </div>
  );
}
export function PdfPreview({
  file,
  organize,
  order,
  onOrder,
  disabled = false,
}: {
  file: File;
  organize: boolean;
  order: number[];
  onOrder: (order: number[]) => void;
  disabled?: boolean;
}) {
  const [state, setState] = useState<{
    count: number;
    thumbs: string[];
    error: string;
  }>({ count: 0, thumbs: [], error: "" });
  useEffect(() => {
    let alive = true;
    let destroy: (() => Promise<void>) | undefined;
    const urls: string[] = [];
    void queuePreview(async () => {
      if (!alive) return;
      const { openRenderer } = await import("@/lib/render");
      const doc = await openRenderer(file);
      destroy = () => doc.loadingTask.destroy();
      if (!alive) {
        await doc.loadingTask.destroy();
        return;
      }
      setState({ count: doc.numPages, thumbs: [], error: "" });
      // Sequential, small previews keep only compressed thumbnail URLs in memory.
      for (let i = 1; i <= (organize ? doc.numPages : 1) && alive; i++) {
        const page = await doc.getPage(i),
          base = page.getViewport({ scale: 1 }),
          viewport = page.getViewport({
            scale: Math.min(140 / base.width, 180 / base.height),
          });
        const canvas = document.createElement("canvas");
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        await page.render({ canvas, viewport }).promise;
        const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r));
        if (blob && alive) {
          const url = URL.createObjectURL(blob);
          urls.push(url);
          if (alive) setState((v) => ({ ...v, thumbs: [...urls] }));
        }
        page.cleanup();
        canvas.width = canvas.height = 0;
      }
      if (alive) await doc.loadingTask.destroy();
    }).catch((e) => {
      void destroy?.();
      if (alive) setState((v) => ({ ...v, error: normalizeError(e) }));
    });
    return () => {
      alive = false;
      void destroy?.();
      urls.forEach(URL.revokeObjectURL);
    };
  }, [file, organize]);
  function move(index: number, delta: number) {
    const next = [...order];
    [next[index], next[index + delta]] = [next[index + delta], next[index]];
    onOrder(next);
  }
  return (
    <div className="pdf-preview">
      {state.error ? (
        <p role="alert">{state.error}</p>
      ) : (
        <p className="hint">
          {state.count ? `${state.count} pages` : "Reading document…"}
        </p>
      )}
      {organize && state.count > 0 && !order.length && (
        <Button
          variant="outline"
          onClick={() =>
            onOrder(Array.from({ length: state.count }, (_, i) => i))
          }
        >
          Restore all pages
        </Button>
      )}
      <div className="page-grid">
        {(organize ? order : [0]).map((page, index) => (
          <div
            className="page-preview"
            key={page}
            draggable={organize && !disabled}
            onDragStart={(e) =>
              e.dataTransfer.setData("text/page", String(index))
            }
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const value = e.dataTransfer.getData("text/page");
              if (!value || disabled) return;
              const from = Number(value),
                next = [...order];
              next.splice(index, 0, next.splice(from, 1)[0]);
              onOrder(next);
            }}
          >
            {state.thumbs[page] && (
              <img
                src={state.thumbs[page]}
                alt={`Page ${page + 1}`}
                loading="lazy"
              />
            )}
            <span>Page {page + 1}</span>
            {organize && (
              <div>
                <Button
                  variant="ghost"
                  aria-label={`Move page ${page + 1} earlier`}
                  disabled={!index}
                  onClick={() => move(index, -1)}
                >
                  ←
                </Button>
                <Button
                  variant="ghost"
                  aria-label={`Move page ${page + 1} later`}
                  disabled={index === order.length - 1}
                  onClick={() => move(index, 1)}
                >
                  →
                </Button>
                <Button
                  variant="ghost"
                  aria-label={`Remove page ${page + 1}`}
                  onClick={() => onOrder(order.filter((p) => p !== page))}
                >
                  ×
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
