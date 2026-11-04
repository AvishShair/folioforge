import type { Settings, ToolId } from "@/lib/domain";
export function SettingsPanel({
  id,
  s,
  set,
}: {
  id: ToolId;
  s: Settings;
  set: (s: Settings) => void;
}) {
  const update = (key: keyof Settings, value: unknown) =>
    set({ ...s, [key]: value });
  const number = (
    label: string,
    key: keyof Settings,
    min: number,
    max: number,
    step = 1,
  ) => (
    <label>
      {label}
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={String(s[key])}
        onChange={(e) => update(key, e.target.value)}
      />
    </label>
  );
  const select = (
    label: string,
    key: keyof Settings,
    options: [string, string][],
  ) => (
    <label>
      {label}
      <select
        value={String(s[key])}
        onChange={(e) => update(key, e.target.value)}
      >
        {options.map(([v, l]) => (
          <option value={v} key={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  );
  const check = (label: string, key: keyof Settings) => (
    <label className="check">
      <input
        type="checkbox"
        checked={Boolean(s[key])}
        onChange={(e) => update(key, e.target.checked)}
      />
      {label}
    </label>
  );
  const image =
    id.includes("image") &&
    id !== "ocr-image" &&
    id !== "images-to-pdf" &&
    id !== "pdf-to-images";
  return (
    <div className="settings-fields">
      {(id === "ocr-image" || id === "ocr-pdf") && (
        <p className="hint">
          English printed text recognition runs locally. The first use downloads
          the OCR engine and language model from this site; your document is
          never uploaded. Proofread results. Output is plain text, not a
          searchable PDF.
        </p>
      )}
      {id === "ocr-pdf" && (
        <>
          <label>
            Pages (blank for all)
            <input
              value={s.pages}
              onChange={(e) => update("pages", e.target.value)}
            />
          </label>
          {number("Render scale", "scale", 0.5, 3, 0.5)}
        </>
      )}
      {(id === "compress-pdf" || id === "redact-pdf") && (
        <>
          {number("Render scale", "scale", 0.5, 3, 0.5)}
          {id === "compress-pdf" &&
            number("JPEG quality (0.1–1)", "quality", 0.1, 1, 0.05)}
          <p className="hint">
            All pages become images. Searchable text, forms, links, signatures,
            tags, and metadata are removed. Keep the original and inspect the
            exported document.
          </p>
        </>
      )}
      {id === "redact-pdf" && (
        <>
          <label>
            Pages to redact (blank for all)
            <input
              value={s.pages}
              onChange={(e) => update("pages", e.target.value)}
              placeholder="1-3, 5"
            />
          </label>
          {number("Redaction left (%)", "cropX", 0, 99, 0.1)}
          {number("Redaction top (%)", "cropY", 0, 99, 0.1)}
          {number("Redaction width (%)", "cropWidth", 1, 100, 0.1)}
          {number("Redaction height (%)", "cropHeight", 1, 100, 0.1)}
          <p className="hint">
            Coordinates use the displayed page’s top-left. The default covers
            the entire page. The same area is removed from each selected page.
            Unselected pages are still rasterized.
          </p>
        </>
      )}
      {id === "number-pages" && (
        <>
          <label>
            Header
            <input
              value={s.header}
              maxLength={120}
              onChange={(e) => update("header", e.target.value)}
            />
          </label>
          <label>
            Footer
            <input
              value={s.footer}
              maxLength={120}
              onChange={(e) => update("footer", e.target.value)}
            />
          </label>
          {number("First page number", "firstNumber", 1, 100000)}
          <p className="hint">
            Use {"{page}"} for the page number and {"{total}"} for total pages.
            Text is centered in the unrotated page coordinates. Latin text only.
            Existing content is preserved; check for overlap.
          </p>
        </>
      )}
      {id === "enhance-image" && (
        <>
          {number("Brightness (1 = unchanged)", "brightness", 0.1, 3, 0.1)}
          {number("Contrast (1 = unchanged)", "contrast", 0.1, 3, 0.1)}
          {number("Saturation (0 = grayscale)", "saturation", 0, 3, 0.1)}
          <p className="hint">
            Color adjustments only; this does not reconstruct detail or provide
            AI super-resolution. Use Resize Image with Allow upscaling for
            interpolation-based enlargement.
          </p>
        </>
      )}
      {["split-pdf", "rotate-pdf", "watermark-pdf", "pdf-to-images"].includes(
        id,
      ) && (
        <label>
          Pages (blank for all)
          <input
            placeholder="e.g. 1-3, 5"
            value={s.pages}
            onChange={(e) => update("pages", e.target.value)}
          />
        </label>
      )}
      {id === "split-pdf" &&
        select("Split mode", "splitMode", [
          ["ranges", "One document per range"],
          ["individual", "One document per page"],
        ])}
      {(id === "rotate-pdf" ||
        id === "rotate-image" ||
        id === "batch-images") &&
        select("Rotation", "angle", [
          ["0", "0°"],
          ["90", "90° clockwise"],
          ["180", "180°"],
          ["270", "270° clockwise"],
        ])}
      {(id === "rotate-image" || id === "batch-images") &&
        select("Flip", "flip", [
          ["none", "No flip"],
          ["horizontal", "Horizontal"],
          ["vertical", "Vertical"],
        ])}
      {(image || id === "pdf-to-images") && (
        <>
          {select(
            "Output format",
            "format",
            id === "pdf-to-images"
              ? [
                  ["image/png", "PNG"],
                  ["image/jpeg", "JPEG"],
                ]
              : [
                  ["image/png", "PNG"],
                  ["image/jpeg", "JPEG"],
                  ["image/webp", "WebP"],
                ],
          )}
          {s.format !== "image/png" &&
            number("Quality (0.1–1)", "quality", 0.1, 1, 0.05)}
          <p className="hint">
            JPEG flattens transparency onto white. PNG is lossless; its encoder
            ignores quality settings. Output can be larger than the original.
          </p>
        </>
      )}
      {(id === "resize-image" || id === "batch-images") && (
        <>
          {number("Width (px)", "width", 1, 12000)}
          {number("Height (px)", "height", 1, 12000)}
          {check("Preserve aspect ratio (fit within dimensions)", "aspect")}
          {check("Allow upscaling", "upscale")}
        </>
      )}
      {id === "images-to-pdf" && (
        <>
          {select("Page size", "paper", [
            ["a4", "A4"],
            ["letter", "Letter"],
            ["fit", "Fit to image"],
          ])}
          {check("Landscape orientation", "landscape")}
          {number("Margin (PDF points)", "margin", 0, 150)}
        </>
      )}
      {id === "pdf-to-images" && number("Render scale", "scale", 0.5, 3, 0.5)}
      {id === "watermark-pdf" && (
        <>
          <label>
            Watermark text
            <input
              value={s.text}
              maxLength={100}
              onChange={(e) => update("text", e.target.value)}
            />
          </label>
          {number("Font size (points)", "fontSize", 8, 150)}
          {number("Opacity", "opacity", 0.05, 1, 0.05)}
          {number("Watermark angle", "watermarkAngle", -90, 90)}
          {select("Position", "position", [
            ["center", "Center"],
            ["top", "Top"],
            ["bottom", "Bottom"],
          ])}
          <p className="hint">
            Standard Helvetica supports Latin text. Other scripts may be
            rejected. Position is relative to the unrotated PDF page.
          </p>
        </>
      )}
      {id === "crop-image" && (
        <>
          <p className="hint">
            Drag the crop on the preview, or enter exact percentages below. The
            crop maps to original image pixels.
          </p>
          {number("Crop left (%)", "cropX", 0, 99, 0.1)}
          {number("Crop top (%)", "cropY", 0, 99, 0.1)}
          {number("Crop width (%)", "cropWidth", 1, 100, 0.1)}
          {number("Crop height (%)", "cropHeight", 1, 100, 0.1)}
        </>
      )}
      {id === "merge-pdf" && (
        <p className="hint">
          Files merge from top to bottom. Drag to reorder or use the arrow
          buttons.
        </p>
      )}
      {id === "organize-pdf" && (
        <p className="hint">
          Move or remove pages in the preview. You must keep at least one page.
        </p>
      )}
      {id === "pdf-metadata" && (
        <p className="hint">
          View metadata and download a JSON report. Unavailable values appear as
          null; empty strings remain empty.
        </p>
      )}
    </div>
  );
}
