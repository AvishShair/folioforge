import { z } from "zod";

export const settingsSchema = z
  .object({
    header: z.string().max(120).default(""),
    footer: z.string().max(120).default("Page {page} of {total}"),
    firstNumber: z.coerce.number().int().min(1).max(100000).default(1),
    brightness: z.coerce.number().min(0.1).max(3).default(1),
    contrast: z.coerce.number().min(0.1).max(3).default(1),
    saturation: z.coerce.number().min(0).max(3).default(1),
    pages: z.string().default(""),
    splitMode: z.enum(["ranges", "individual"]).default("ranges"),
    angle: z.coerce
      .number()
      .refine((n) => [0, 90, 180, 270].includes(n))
      .default(90),
    format: z
      .enum(["image/png", "image/jpeg", "image/webp"])
      .default("image/png"),
    quality: z.coerce.number().min(0.1).max(1).default(0.85),
    width: z.coerce.number().int().min(1).max(12000).default(1600),
    height: z.coerce.number().int().min(1).max(12000).default(1200),
    aspect: z.boolean().default(true),
    upscale: z.boolean().default(false),
    flip: z.enum(["none", "horizontal", "vertical"]).default("none"),
    paper: z.enum(["a4", "letter", "fit"]).default("a4"),
    landscape: z.boolean().default(false),
    margin: z.coerce.number().min(0).max(150).default(24),
    scale: z.coerce.number().min(0.5).max(3).default(1.5),
    text: z.string().max(100).default("CONFIDENTIAL"),
    fontSize: z.coerce.number().min(8).max(150).default(36),
    opacity: z.coerce.number().min(0.05).max(1).default(0.25),
    position: z.enum(["center", "top", "bottom"]).default("center"),
    watermarkAngle: z.coerce.number().min(-90).max(90).default(30),
    order: z.array(z.number().int().nonnegative()).default([]),
    cropX: z.coerce.number().min(0).max(99).default(0),
    cropY: z.coerce.number().min(0).max(99).default(0),
    cropWidth: z.coerce.number().min(1).max(100).default(100),
    cropHeight: z.coerce.number().min(1).max(100).default(100),
  })
  .refine(
    (s) => s.cropX + s.cropWidth <= 100 && s.cropY + s.cropHeight <= 100,
    "Crop must stay inside the image",
  );
export type Settings = z.infer<typeof settingsSchema>;
export interface OutputFile {
  name: string;
  blob: Blob;
  mimeType: string;
  originalBytes?: number;
}
export interface ProcessingResult {
  files: OutputFile[];
  warnings: string[];
  durationMs: number;
  metadata?: Record<string, unknown>;
}
export interface ProcessingContext {
  signal: AbortSignal;
  onProgress?: (completed: number, total: number, message: string) => void;
}
export const definitions = [
  [
    "ocr-image",
    "Image to Text (OCR)",
    "Recognize English printed text locally and download a text file.",
    "image",
    1,
    1,
  ],
  [
    "ocr-pdf",
    "Scanned PDF to Text",
    "Recognize English printed text from selected scanned PDF pages.",
    "pdf",
    1,
    1,
  ],
  [
    "compress-pdf",
    "Compress Scanned PDF",
    "Rebuild pages as JPEG images. Searchable text and interactive features are flattened.",
    "pdf",
    1,
    1,
  ],
  [
    "redact-pdf",
    "Redact PDF Area",
    "Permanently remove a rectangular area by rebuilding every page from pixels.",
    "pdf",
    1,
    1,
  ],
  [
    "number-pages",
    "Page Numbers & Headers",
    "Add custom headers, footers, and sequential page numbers.",
    "pdf",
    1,
    1,
  ],
  [
    "enhance-image",
    "Enhance Image",
    "Adjust brightness, contrast, and saturation locally.",
    "image",
    1,
    30,
  ],
  [
    "merge-pdf",
    "Merge PDF",
    "Bring documents together in exactly the right order.",
    "pdf",
    2,
    30,
  ],
  [
    "split-pdf",
    "Split PDF",
    "Extract a selection or give each page its own file.",
    "pdf",
    1,
    1,
  ],
  [
    "rotate-pdf",
    "Rotate PDF",
    "Turn selected pages without changing the rest.",
    "pdf",
    1,
    1,
  ],
  [
    "images-to-pdf",
    "Images to PDF",
    "Make a neatly sized document from your images.",
    "image",
    1,
    30,
  ],
  [
    "pdf-to-images",
    "PDF to Images",
    "Render PDF pages as crisp PNG or JPEG images.",
    "pdf",
    1,
    1,
  ],
  [
    "watermark-pdf",
    "Watermark PDF",
    "Add a transparent text mark to your pages.",
    "pdf",
    1,
    1,
  ],
  [
    "organize-pdf",
    "Organize PDF",
    "Rearrange and remove pages with a visual overview.",
    "pdf",
    1,
    1,
  ],
  [
    "pdf-metadata",
    "PDF Metadata",
    "Inspect document details and page dimensions.",
    "pdf",
    1,
    1,
  ],
  [
    "compress-image",
    "Compress Image",
    "Tune format and quality, then compare actual sizes.",
    "image",
    1,
    30,
  ],
  [
    "resize-image",
    "Resize Image",
    "Set pixel dimensions with control over proportions.",
    "image",
    1,
    30,
  ],
  [
    "convert-image",
    "Convert Image",
    "Move between JPEG, PNG, and WebP.",
    "image",
    1,
    30,
  ],
  [
    "rotate-image",
    "Rotate & Flip",
    "Find the right orientation for every image.",
    "image",
    1,
    30,
  ],
  [
    "crop-image",
    "Crop Image",
    "Keep the part that matters at original resolution.",
    "image",
    1,
    1,
  ],
  [
    "batch-images",
    "Batch Images",
    "Resize, rotate, and convert a collection in one pass.",
    "image",
    1,
    30,
  ],
] as const;
export type ToolId = (typeof definitions)[number][0];
export const tools = definitions.map(
  ([id, name, description, input, minFiles, maxFiles]) => ({
    id,
    name,
    description,
    input,
    minFiles,
    maxFiles,
    route: `/tools/${id}`,
    category: id === "images-to-pdf" || input === "pdf" ? "PDF" : "Image",
    accepted: input === "pdf" ? ".pdf" : ".jpg,.jpeg,.png,.webp",
    settingsSchema,
    outputType:
      id === "ocr-image" || id === "ocr-pdf"
        ? "text"
        : id === "pdf-metadata"
          ? "json"
          : id === "pdf-to-images" ||
              (input === "image" && id !== "images-to-pdf")
            ? "image"
            : "pdf",
    capabilities: ["Local processing", "Downloadable output"],
    limitations:
      id === "compress-pdf" || id === "redact-pdf"
        ? [
            "Every page is rasterized. Searchable text, links, forms, signatures, metadata, and accessibility tags are removed.",
            "Area coordinates are percentages of the displayed page, measured from its top-left.",
            "Compression can increase file size. Inspect all output pages before sharing.",
          ]
        : input === "pdf"
          ? [
              "Encrypted PDFs are not supported.",
              "Editing can invalidate signatures and discard interactive document features.",
            ]
          : [
              "Animated images export as a single frame.",
              "JPEG output uses a white background.",
            ],
    handler: async (
      files: File[],
      settings: Settings,
      context: ProcessingContext,
    ) =>
      (await import("./processing")).processFiles(id, files, settings, context),
  }),
);
