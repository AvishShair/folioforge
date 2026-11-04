import { describe, it, expect } from "vitest";
import { PDFDocument } from "pdf-lib";
import {
  pageRanges,
  safeName,
  sizeChange,
  dimensions,
  normalizeError,
  validateFile,
} from "../src/lib/validation";
import { settingsSchema, tools } from "../src/lib/domain";
import { processPdf } from "../src/lib/pdf";
import { checkImageHeader } from "../src/lib/image-header";
const settings = settingsSchema.parse({});
const context = { signal: new AbortController().signal };
async function fixture(widths: number[]) {
  const doc = await PDFDocument.create();
  for (const width of widths) doc.addPage([width, 400]);
  return new File([new Uint8Array(await doc.save())], "test.pdf", {
    type: "application/pdf",
  });
}
describe("validation", () => {
  it("rejects oversized image headers before native decoding", async () => {
    const data = new Uint8Array(24);
    data.set([137, 80, 78, 71, 13, 10, 26, 10]);
    const view = new DataView(data.buffer);
    view.setUint32(16, 10000);
    view.setUint32(20, 10000);
    await expect(checkImageHeader(new Blob([data]))).rejects.toThrow(
      "32 megapixel",
    );
  });
  it("parses ordered ranges and rejects invalid selections", () => {
    expect(pageRanges("3,1-2", 3)).toEqual([[2], [0, 1]]);
    expect(pageRanges("", 2)).toEqual([[0, 1]]);
    for (const value of ["0", "4", "2-1", "1,,2", "1.5"])
      expect(() => pageRanges(value, 3)).toThrow();
  });
  it("normalizes names, size differences, and errors", () => {
    expect(safeName("../My file.pdf", "png")).toBe("___My_file.png");
    expect(sizeChange(100, 120)).toBe(-20);
    expect(normalizeError(new Error("encrypted"))).toContain("Password");
  });
  it("preserves aspect and prevents upscaling", () => {
    expect(dimensions(100, 50, 50, 50)).toEqual({ width: 50, height: 25 });
    expect(dimensions(100, 50, 200, 200)).toEqual({ width: 100, height: 50 });
    expect(dimensions(100, 50, 200, 100, false, true)).toEqual({
      width: 200,
      height: 100,
    });
  });
  it("checks signatures, MIME, extensions, and empty files", async () => {
    await expect(
      validateFile(await fixture([200]), "pdf"),
    ).resolves.toBeUndefined();
    await expect(
      validateFile(
        new File(["bad"], "bad.pdf", { type: "application/pdf" }),
        "pdf",
      ),
    ).rejects.toThrow();
    await expect(
      validateFile(new File([], "empty.png"), "image"),
    ).rejects.toThrow();
  });
  it("validates settings and registry", () => {
    expect(new Set(tools.map((t) => t.id)).size).toBe(14);
    for (const tool of tools) {
      expect(tool.route).toBe(`/tools/${tool.id}`);
      expect(tool.handler).toBeTypeOf("function");
    }
    expect(settingsSchema.safeParse({ quality: 2 }).success).toBe(false);
    expect(settingsSchema.safeParse({ cropX: 90, cropWidth: 20 }).success).toBe(
      false,
    );
  });
});
describe("real PDF processing", () => {
  it("merges pages in exact order", async () => {
    const result = await processPdf(
      "merge-pdf",
      [await fixture([200, 300]), await fixture([400])],
      settings,
      context,
    );
    const doc = await PDFDocument.load(
      await result.files[0].blob.arrayBuffer(),
    );
    expect(doc.getPages().map((p) => p.getWidth())).toEqual([200, 300, 400]);
  });
  it("splits groups and individual pages", async () => {
    const file = await fixture([200, 300, 400]);
    const result = await processPdf(
      "split-pdf",
      [file],
      { ...settings, pages: "3,1-2" },
      context,
    );
    expect(result.files.length).toBe(2);
    expect(
      (
        await PDFDocument.load(await result.files[1].blob.arrayBuffer())
      ).getPageCount(),
    ).toBe(2);
    expect(
      (await PDFDocument.load(await result.files[0].blob.arrayBuffer()))
        .getPage(0)
        .getWidth(),
    ).toBe(400);
  });
  it("rotates only selected pages", async () => {
    const result = await processPdf(
      "rotate-pdf",
      [await fixture([200, 300])],
      { ...settings, pages: "2", angle: 90 },
      context,
    );
    const doc = await PDFDocument.load(
      await result.files[0].blob.arrayBuffer(),
    );
    expect(doc.getPages().map((p) => p.getRotation().angle)).toEqual([0, 90]);
  });
  it("organizes and rejects empty output", async () => {
    const file = await fixture([200, 300, 400]);
    const result = await processPdf(
      "organize-pdf",
      [file],
      { ...settings, order: [2, 0] },
      context,
    );
    const doc = await PDFDocument.load(
      await result.files[0].blob.arrayBuffer(),
    );
    expect(doc.getPages().map((p) => p.getWidth())).toEqual([400, 200]);
    await expect(
      processPdf("organize-pdf", [file], settings, context),
    ).rejects.toThrow();
  });
  it("watermarks a valid document and reports metadata", async () => {
    const file = await fixture([200]);
    const result = await processPdf("watermark-pdf", [file], settings, context);
    const doc = await PDFDocument.load(
      await result.files[0].blob.arrayBuffer(),
    );
    expect(doc.getPage(0).node.Contents()).toBeDefined();
    const metadata = await processPdf(
      "pdf-metadata",
      [file],
      settings,
      context,
    );
    expect(metadata.metadata?.pageCount).toBe(1);
    expect(metadata.metadata?.title).toBeNull();
  });
});
