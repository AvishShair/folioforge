import { test, expect, type Page } from "@playwright/test";
import { PDFDocument, PDFName, PDFDict } from "pdf-lib";
import { readFile } from "node:fs/promises";
import JSZip from "jszip";
async function pdf() {
  const doc = await PDFDocument.create();
  doc.addPage([200, 300]);
  doc.addPage([400, 500]);
  return Buffer.from(await doc.save());
}
async function png(page: Page) {
  return Buffer.from(
    await page.evaluate(async () => {
      const c = document.createElement("canvas");
      c.width = 100;
      c.height = 60;
      const ctx = c.getContext("2d")!;
      ctx.fillStyle = "red";
      ctx.fillRect(0, 0, 50, 60);
      const blob = await new Promise<Blob>((r) => c.toBlob((b) => r(b!)));
      return Array.from(new Uint8Array(await blob.arrayBuffer()));
    }),
  );
}
async function runDownload(page: Page) {
  await page.getByRole("button", { name: /^Run / }).click();
  await expect(
    page.getByRole("heading", { name: "Your files, freshly forged." }),
  ).toBeVisible();
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: /Download (result|ZIP)/ }).click();
  const download = await pending;
  return readFile((await download.path())!);
}
async function decode(page: Page, buffer: Buffer) {
  return page.evaluate(async (data) => {
    const bitmap = await createImageBitmap(new Blob([new Uint8Array(data)]));
    const c = document.createElement("canvas");
    c.width = bitmap.width;
    c.height = bitmap.height;
    const ctx = c.getContext("2d")!;
    ctx.drawImage(bitmap, 0, 0);
    const pixel = Array.from(ctx.getImageData(c.width - 1, 0, 1, 1).data);
    const result = { width: bitmap.width, height: bitmap.height, pixel };
    bitmap.close();
    return result;
  }, Array.from(buffer));
}

test("page labels, image enhancement, PDF compression and permanent raster redaction", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/tools/number-pages");
  const original = await PDFDocument.create();
  original.setTitle("PRIVATE METADATA");
  original
    .addPage([300, 400])
    .drawText("PRIVATE CONTENT", { x: 40, y: 200, size: 18 });
  const input = Buffer.from(await original.save());
  const upload = async () =>
    page.locator("input[type=file]").setInputFiles({
      name: "source.pdf",
      mimeType: "application/pdf",
      buffer: input,
    });
  await upload();
  await page.getByLabel("Header", { exact: true }).fill("Report");
  const numbered = await PDFDocument.load(await runDownload(page));
  expect(numbered.getPageCount()).toBe(1);
  expect(numbered.getTitle()).toBe("PRIVATE METADATA");
  await page.goto("/tools/enhance-image");
  const image = await png(page);
  await page.locator("input[type=file]").setInputFiles({
    name: "source.png",
    mimeType: "image/png",
    buffer: image,
  });
  await page.getByLabel("Saturation (0 = grayscale)").fill("0");
  const enhanced = await runDownload(page);
  const gray = await page.evaluate(async (values) => {
    const image = await createImageBitmap(new Blob([new Uint8Array(values)]));
    const c = document.createElement("canvas");
    c.width = image.width;
    c.height = image.height;
    const ctx = c.getContext("2d")!;
    ctx.drawImage(image, 0, 0);
    const p = Array.from(ctx.getImageData(0, 0, 1, 1).data);
    image.close();
    return p;
  }, Array.from(enhanced));
  expect(gray[0]).toBe(gray[1]);
  expect(gray[1]).toBe(gray[2]);
  expect(gray[3]).toBe(255);
  for (const slug of ["compress-pdf", "redact-pdf"]) {
    await page.goto(`/tools/${slug}`);
    await upload();
    const output = await runDownload(page);
    const doc = await PDFDocument.load(output);
    expect(doc.getTitle()).toBeUndefined();
    expect(doc.getPageCount()).toBe(1);
    expect(doc.getPage(0).getWidth()).toBe(300);
    expect(
      doc
        .getPage(0)
        .node.Resources()
        ?.lookup(PDFName.of("Font"), PDFDict)
        .keys().length,
    ).toBe(0);
    if (slug === "redact-pdf") {
      await page.goto("/tools/pdf-to-images");
      await page.locator("input[type=file]").setInputFiles({
        name: "redacted.pdf",
        mimeType: "application/pdf",
        buffer: output,
      });
      expect((await decode(page, await runDownload(page))).pixel).toEqual([
        0, 0, 0, 255,
      ]);
    }
  }
});

test("private English OCR recognizes images and scanned PDF pages", async ({
  page,
}) => {
  test.setTimeout(120000);
  await page.goto("/tools/ocr-image");
  const data = Buffer.from(
    await page.evaluate(async () => {
      const c = document.createElement("canvas");
      c.width = 800;
      c.height = 180;
      const ctx = c.getContext("2d")!;
      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, 800, 180);
      ctx.fillStyle = "black";
      ctx.font = "48px Arial";
      ctx.fillText("FOLIOFORGE 12345", 30, 100);
      const b = await new Promise<Blob>((r) => c.toBlob((b) => r(b!)));
      return Array.from(new Uint8Array(await b.arrayBuffer()));
    }),
  );
  await page
    .locator("input[type=file]")
    .setInputFiles({ name: "scan.png", mimeType: "image/png", buffer: data });
  await page.getByRole("button", { name: /^Run / }).click();
  await expect(
    page.getByRole("heading", { name: "Your files, freshly forged." }),
  ).toBeVisible({ timeout: 90000 });
  let pending = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download result" }).click();
  expect(
    (await readFile((await (await pending).path())!)).toString(),
  ).toContain("12345");
  const pdf = await PDFDocument.create(),
    image = await pdf.embedPng(data);
  pdf
    .addPage([800, 180])
    .drawImage(image, { x: 0, y: 0, width: 800, height: 180 });
  await page.goto("/tools/ocr-pdf");
  await page
    .locator("input[type=file]")
    .setInputFiles({
      name: "scan.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from(await pdf.save()),
    });
  await page.getByRole("button", { name: /^Run / }).click();
  await expect(
    page.getByRole("heading", { name: "Your files, freshly forged." }),
  ).toBeVisible({ timeout: 90000 });
  pending = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download result" }).click();
  expect(
    (await readFile((await (await pending).path())!)).toString(),
  ).toContain("FOLIOFORGE");
});
test("home search, navigation, theme, keyboard, and mobile", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /Your files./ }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Switch to dark theme" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByRole("button", { name: "Switch to light theme" }).click();
  await page.getByRole("textbox", { name: "Search tools" }).fill("merge");
  await page.getByRole("link", { name: /Merge PDF/ }).click();
  await expect(
    page.getByRole("heading", { name: "Merge PDF", exact: true }),
  ).toBeVisible();
  await page.setViewportSize({ width: 375, height: 812 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.keyboard.press("Tab");
  await expect(page.locator(":focus")).toBeVisible();
  await page.screenshot({ path: "test-results/mobile.png", fullPage: true });
});
test("PDF merge produces valid download, validates inputs and resets", async ({
  page,
}) => {
  await page.goto("/tools/merge-pdf");
  await page.locator("input[type=file]").setInputFiles({
    name: "bad.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("invalid"),
  });
  await expect(page.locator(".error[role=alert]")).toContainText("signature");
  const data = await pdf();
  await page.locator("input[type=file]").setInputFiles([
    { name: "a.pdf", mimeType: "application/pdf", buffer: data },
    { name: "b.pdf", mimeType: "application/pdf", buffer: data },
  ]);
  const result = await runDownload(page);
  expect((await PDFDocument.load(result)).getPageCount()).toBe(4);
  await page.getByRole("button", { name: "Reset workspace" }).click();
  await expect(page.getByText("0 selected")).toBeVisible();
});
test("image resize, conversion transparency, rotation, crop and batch ZIP", async ({
  page,
}) => {
  await page.goto("/tools/resize-image");
  const image = await png(page);
  await page.locator("input[type=file]").setInputFiles({
    name: "sample.png",
    mimeType: "image/png",
    buffer: image,
  });
  await page.getByLabel("Width (px)").fill("50");
  await page.getByLabel("Height (px)").fill("50");
  const resized = await decode(page, await runDownload(page));
  expect(resized.width).toBe(50);
  expect(resized.height).toBe(30);
  expect(resized.pixel[3]).toBe(0);
  await page.goto("/tools/convert-image");
  await page.locator("input[type=file]").setInputFiles({
    name: "sample.png",
    mimeType: "image/png",
    buffer: image,
  });
  await page.getByLabel("Output format").selectOption("image/jpeg");
  const jpg = await runDownload(page);
  expect(jpg[0]).toBe(255);
  expect(jpg[1]).toBe(216);
  const decoded = await decode(page, jpg);
  expect(decoded.pixel).toEqual([255, 255, 255, 255]);
  await page.goto("/tools/rotate-image");
  await page.locator("input[type=file]").setInputFiles({
    name: "sample.png",
    mimeType: "image/png",
    buffer: image,
  });
  const rotated = await decode(page, await runDownload(page));
  expect([rotated.width, rotated.height]).toEqual([60, 100]);
  await page.goto("/tools/crop-image");
  await page.locator("input[type=file]").setInputFiles({
    name: "sample.png",
    mimeType: "image/png",
    buffer: image,
  });
  await page.getByLabel("Crop width (%)").fill("50");
  const cropped = await decode(page, await runDownload(page));
  expect([cropped.width, cropped.height]).toEqual([50, 60]);
  await page.goto("/tools/batch-images");
  await page.locator("input[type=file]").setInputFiles([
    { name: "one.png", mimeType: "image/png", buffer: image },
    { name: "two.png", mimeType: "image/png", buffer: image },
  ]);
  const zip = await JSZip.loadAsync(await runDownload(page));
  expect(Object.keys(zip.files).length).toBe(2);
  for (const entry of Object.values(zip.files)) {
    const img = await decode(page, await entry.async("nodebuffer"));
    expect(img.width).toBe(60);
  }
});
test("images to PDF and PDF rendering produce decoded outputs", async ({
  page,
}) => {
  await page.goto("/tools/images-to-pdf");
  const image = await png(page);
  await page.locator("input[type=file]").setInputFiles({
    name: "sample.png",
    mimeType: "image/png",
    buffer: image,
  });
  const doc = await PDFDocument.load(await runDownload(page));
  expect(doc.getPageCount()).toBe(1);
  expect(doc.getPage(0).getWidth()).toBeCloseTo(595.28, 1);
  await page.goto("/tools/pdf-to-images");
  await page.locator("input[type=file]").setInputFiles({
    name: "sample.pdf",
    mimeType: "application/pdf",
    buffer: await pdf(),
  });
  await page.getByLabel("Pages (blank for all)").fill("1");
  const img = await decode(page, await runDownload(page));
  expect([img.width, img.height]).toEqual([300, 450]);
});
test("all tool routes load with correct titles", async ({ page }) => {
  for (const slug of [
    "split-pdf",
    "rotate-pdf",
    "watermark-pdf",
    "organize-pdf",
    "pdf-metadata",
    "compress-image",
  ]) {
    await page.goto(`/tools/${slug}`);
    await expect(
      page.getByRole("button", { name: "Choose files" }),
    ).toBeVisible();
  }
});

test("remaining PDF tools process real files and organizer exports selected order", async ({
  page,
}) => {
  const data = await pdf();
  const upload = async () =>
    page.locator("input[type=file]").setInputFiles({
      name: "sample.pdf",
      mimeType: "application/pdf",
      buffer: data,
    });
  await page.goto("/tools/split-pdf");
  await upload();
  await page.getByLabel("Split mode").selectOption("individual");
  const zip = await JSZip.loadAsync(await runDownload(page));
  expect(Object.keys(zip.files)).toHaveLength(2);
  for (const file of Object.values(zip.files))
    expect(
      (await PDFDocument.load(await file.async("nodebuffer"))).getPageCount(),
    ).toBe(1);
  await page.goto("/tools/rotate-pdf");
  await upload();
  await page.getByLabel("Pages (blank for all)").fill("2");
  const rotated = await PDFDocument.load(await runDownload(page));
  expect(rotated.getPages().map((p) => p.getRotation().angle)).toEqual([0, 90]);
  await page.goto("/tools/organize-pdf");
  await upload();
  await page.getByRole("button", { name: "Move page 2 earlier" }).click();
  const organized = await PDFDocument.load(await runDownload(page));
  expect(organized.getPages().map((p) => p.getWidth())).toEqual([400, 200]);
  await page
    .getByRole("button", { name: "Remove page 1", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Remove page 2", exact: true })
    .click();
  await page.getByRole("button", { name: /^Run / }).click();
  await expect(page.locator(".error")).toContainText("Keep at least one");
  await page.goto("/tools/pdf-metadata");
  await upload();
  const metadata = JSON.parse((await runDownload(page)).toString());
  expect(metadata.pageCount).toBe(2);
  expect(metadata.title).toBeNull();
  await page.goto("/tools/watermark-pdf");
  await upload();
  await page.getByLabel("Watermark text").fill("TEST");
  await page.getByLabel("Font size (points)").fill("20");
  await page.getByLabel("Watermark angle").fill("0");
  const watermarked = await runDownload(page);
  expect((await PDFDocument.load(watermarked)).getPageCount()).toBe(2);
  // Re-render the produced PDF and verify visible marks were added to the blank fixture.
  await page.goto("/tools/pdf-to-images");
  await page.locator("input[type=file]").setInputFiles({
    name: "marked.pdf",
    mimeType: "application/pdf",
    buffer: watermarked,
  });
  await page.getByLabel("Pages (blank for all)").fill("1");
  const rendered = await runDownload(page);
  const ink = await page.evaluate(async (values) => {
    const img = await createImageBitmap(new Blob([new Uint8Array(values)]));
    const c = document.createElement("canvas");
    c.width = img.width;
    c.height = img.height;
    const ctx = c.getContext("2d")!;
    ctx.drawImage(img, 0, 0);
    const pixels = ctx.getImageData(0, 0, c.width, c.height).data;
    let count = 0,
      minY = c.height,
      maxY = 0;
    for (let i = 0; i < pixels.length; i += 4)
      if (pixels[i] < 250) {
        count++;
        const y = Math.floor(i / 4 / c.width);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
      }
    img.close();
    return { count, minY, maxY, height: c.height };
  }, Array.from(rendered));
  expect(ink.count).toBeGreaterThan(20);
  expect(ink.minY).toBeGreaterThan(ink.height * 0.35);
  expect(ink.maxY).toBeLessThan(ink.height * 0.65);
});

test("image codecs, compression and partial batch failure", async ({
  page,
}) => {
  await page.goto("/tools/convert-image");
  const source = await png(page);
  for (const format of ["image/webp", "image/jpeg", "image/png"]) {
    await page.goto("/tools/convert-image");
    await page.locator("input[type=file]").setInputFiles({
      name: "source.png",
      mimeType: "image/png",
      buffer: source,
    });
    await page.getByLabel("Output format").selectOption(format);
    const output = await runDownload(page);
    expect((await decode(page, output)).width).toBe(100);
    if (format !== "image/png") {
      await page.goto("/tools/convert-image");
      await page.locator("input[type=file]").setInputFiles({
        name: format === "image/webp" ? "input.webp" : "input.jpg",
        mimeType: format,
        buffer: output,
      });
      await page.getByLabel("Output format").selectOption("image/png");
      expect((await decode(page, await runDownload(page))).width).toBe(100);
    }
  }
  await page.goto("/tools/compress-image");
  const invalid = Buffer.from(source.subarray(0, 32));
  await page.locator("input[type=file]").setInputFiles([
    { name: "valid.png", mimeType: "image/png", buffer: source },
    { name: "corrupt.png", mimeType: "image/png", buffer: invalid },
  ]);
  const output = await runDownload(page);
  expect((await decode(page, output)).width).toBe(100);
  await expect(page.locator(".warning")).toContainText("corrupt.png");
});

test("desktop and mobile home remain usable with no client errors", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.screenshot({
    path: "test-results/home-desktop.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Switch to dark theme" }).click();
  await page.screenshot({ path: "test-results/home-dark.png", fullPage: true });
  await page.setViewportSize({ width: 375, height: 812 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/home-mobile.png",
    fullPage: true,
  });
  expect(errors).toEqual([]);
});
