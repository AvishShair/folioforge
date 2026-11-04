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
    id.includes("image") && id !== "images-to-pdf" && id !== "pdf-to-images";
  return (
    <div className="settings-fields">
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
