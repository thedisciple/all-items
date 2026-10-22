import { expect, test, type Page } from "@playwright/test";
import sharp from "sharp";

async function syntheticPhoto(width = 640, height = 480) {
  return sharp({ create: { width, height, channels: 3, background: { r: 85, g: 125, b: 165 } } })
    .composite([{ input: Buffer.from(`<svg width="${width}" height="${height}"><rect x="24" y="24" width="${width - 48}" height="${height - 48}" fill="none" stroke="#c5f36b" stroke-width="18"/><circle cx="${width / 2}" cy="${height / 2}" r="70" fill="#f5ba67"/></svg>`) }])
    .png().toBuffer();
}

async function readCropState(page: Page) {
  return page.locator(".photo-cropper-widget").evaluate((root) => {
    const image = root.querySelector<HTMLImageElement>(":scope > img") as (HTMLImageElement & { cropper?: { getImageData: () => { width: number; height: number }; getData: () => { rotate?: number }; getCropBoxData: () => { left: number; top: number; width: number; height: number } } }) | null;
    const instance = image?.cropper;
    if (!instance) throw new Error("Cropper instance is not attached to the image");
    return { image: instance.getImageData(), rotation: instance.getData().rotate ?? 0, cropBox: instance.getCropBoxData() };
  });
}

async function selectPhoto(page: Page, name = "synthetic.png", buffer?: Buffer) {
  buffer ??= await syntheticPhoto();
  await page.getByRole("button", { name: "Добавить фото" }).click();
  await page.locator('input[name="photo"]').setInputFiles({ name, mimeType: "image/png", buffer });
  const editor = page.getByRole("dialog", { name: "Обрезать фотографию" });
  await expect(editor.getByRole("button", { name: "Подтвердить кадр" })).toBeEnabled();
  return editor;
}

async function createWithCrop(page: Page, name: string) {
  await page.goto("/");
  await page.locator(".add-dialog-trigger").click();
  const addDialog = page.getByRole("dialog", { name: "Добавить вещь" });
  const editor = await selectPhoto(page);
  await editor.getByRole("button", { name: "Подтвердить кадр" }).click();
  await addDialog.getByLabel("Название").fill(name);
  await addDialog.getByRole("button", { name: "Добавить вещь" }).click();
  await expect(page).toHaveURL(/added=/);
  await page.getByRole("link", { name: new RegExp(name) }).click();
  await expect(page.locator(".photo-viewer-image img")).toBeVisible();
}

test("waits for image readiness, applies zoom and aspect controls, crops, and opens a compact photo viewer", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto("/");
  await page.locator(".add-dialog-trigger").click();
  const addDialog = page.getByRole("dialog", { name: "Добавить вещь" });
  const editor = await selectPhoto(page);
  const stateBeforeZoom = await readCropState(page);
  const zoom = editor.getByRole("slider", { name: "Масштаб" });
  await zoom.evaluate((element) => {
    const input = element as HTMLInputElement;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    setter?.call(input, "1.65");
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await expect(editor.locator(".crop-zoom output")).toHaveText("1.65×");
  await expect.poll(async () => (await readCropState(page)).image.width).toBeGreaterThan(stateBeforeZoom.image.width * 1.25);
  const beforeWheelZoom = (await readCropState(page)).image.width;
  const imageBounds = await editor.locator(".cropper-canvas").boundingBox();
  expect(imageBounds).not.toBeNull();
  await page.mouse.move(imageBounds!.x + imageBounds!.width / 2, imageBounds!.y + imageBounds!.height / 2);
  await page.mouse.wheel(0, -120);
  await expect.poll(async () => (await readCropState(page)).image.width).toBeGreaterThan(beforeWheelZoom);

  const aspect = editor.getByLabel("Формат кадра");
  await aspect.selectOption("original");
  expect(Math.abs((await readCropState(page)).cropBox.width / (await readCropState(page)).cropBox.height - 4 / 3)).toBeLessThan(0.03);
  await editor.getByRole("button", { name: "Повернуть на 90°" }).click();
  await expect.poll(async () => (await readCropState(page)).rotation).toBe(90);
  expect(Math.abs((await readCropState(page)).cropBox.width / (await readCropState(page)).cropBox.height - 3 / 4)).toBeLessThan(0.05);
  await aspect.selectOption("16:9");
  expect(Math.abs((await readCropState(page)).cropBox.width / (await readCropState(page)).cropBox.height - 16 / 9)).toBeLessThan(0.05);
  const boxBeforeDrag = (await readCropState(page)).cropBox;
  const boxBounds = await editor.locator(".cropper-crop-box").boundingBox();
  expect(boxBounds).not.toBeNull();
  await page.mouse.move(boxBounds!.x + boxBounds!.width / 2, boxBounds!.y + boxBounds!.height / 2);
  await page.mouse.down();
  await page.mouse.move(boxBounds!.x + boxBounds!.width / 2 + 24, boxBounds!.y + boxBounds!.height / 2 + 12, { steps: 5 });
  await page.mouse.up();
  await expect.poll(async () => (await readCropState(page)).cropBox.left).not.toBeCloseTo(boxBeforeDrag.left, 0);
  const handle = editor.locator(".cropper-point.point-se");
  expect(await handle.evaluate((element) => element.getBoundingClientRect().width)).toBeGreaterThanOrEqual(20);
  const boxBeforeResize = (await readCropState(page)).cropBox;
  const handleBounds = await handle.boundingBox();
  expect(handleBounds).not.toBeNull();
  await page.mouse.move(handleBounds!.x + handleBounds!.width / 2, handleBounds!.y + handleBounds!.height / 2);
  await page.mouse.down();
  await page.mouse.move(handleBounds!.x + handleBounds!.width / 2 + 28, handleBounds!.y + handleBounds!.height / 2 + 18, { steps: 5 });
  await page.mouse.up();
  await expect.poll(async () => (await readCropState(page)).cropBox.width).not.toBeCloseTo(boxBeforeResize.width, 0);
  await editor.getByRole("button", { name: "Сбросить кадр" }).click();
  await expect.poll(async () => (await readCropState(page)).rotation).toBe(0);
  await expect(aspect).toHaveValue("free");
  await editor.getByRole("button", { name: "Подтвердить кадр" }).click();
  await addDialog.getByLabel("Название").fill("M2D-R1 cropped item");
  await addDialog.getByRole("button", { name: "Добавить вещь" }).click();
  await expect(page).toHaveURL(/added=/);
  await page.getByRole("link", { name: /M2D-R1 cropped item/ }).click();

  await expect(page.locator(".item-number-badge")).toBeVisible();
  await expect(page.locator("body")).not.toContainText(/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i);
  const photo = page.locator(".photo-viewer-image img.detail-photo");
  await expect(photo).toHaveCount(1);
  expect(await photo.evaluate((image) => image.getBoundingClientRect().height)).toBeLessThanOrEqual(300);
  await page.getByRole("button", { name: "Увеличить фотографию" }).click();
  const viewer = page.getByRole("dialog", { name: "Просмотр фотографии" });
  await expect(viewer).toBeVisible();
  await expect(viewer.locator("img.detail-photo")).toHaveCount(1);
  expect(await photo.evaluate((image) => image.getBoundingClientRect().height)).toBeGreaterThan(300);
  await page.keyboard.press("Escape");
  await expect(viewer).toHaveCount(0);

  await page.getByLabel("Язык").selectOption("en");
  await expect(page.getByRole("button", { name: "Edit" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Replace photo" })).toBeVisible();
  await expect(page.getByLabel("Language")).toHaveValue("en");
  expect(pageErrors).toEqual([]);
});

test("rejects invalid crop coordinates and allows item creation with the original image", async ({ page }) => {
  await page.goto("/");
  await page.locator(".add-dialog-trigger").click();
  const addDialog = page.getByRole("dialog", { name: "Добавить вещь" });
  const editor = await selectPhoto(page);
  await page.locator(".photo-cropper-widget").evaluate((root) => {
    const image = root.querySelector<HTMLImageElement>(":scope > img") as (HTMLImageElement & { cropper?: { setData: (data: { width: number; height: number }) => void } }) | null;
    image?.cropper?.setData({ width: 20, height: 20 });
  });
  await editor.getByRole("button", { name: "Подтвердить кадр" }).click();
  await expect(editor.getByText(/Кадр слишком маленький/)).toBeVisible();
  await editor.getByRole("button", { name: "Продолжить без кадрирования" }).click();
  await addDialog.getByLabel("Название").fill("M2D-R1 original fallback item");
  await addDialog.getByRole("button", { name: "Добавить вещь" }).click();
  await expect(page).toHaveURL(/added=/);
  await page.getByRole("link", { name: /M2D-R1 original fallback item/ }).click();
  await expect(page.locator(".photo-viewer-image img.detail-photo")).toBeVisible();
});

test("recovers from canvas encoding failure and keeps an existing saved photo on replacement failure", async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.toBlob;
    Object.defineProperty(window, "failCanvasEncoding", { value: false, writable: true });
    HTMLCanvasElement.prototype.toBlob = function (callback, type, quality) {
      if ((window as Window & { failCanvasEncoding?: boolean }).failCanvasEncoding) { callback(null); return; }
      original.call(this, callback, type, quality);
    };
  });
  await createWithCrop(page, "M2D-R1 recovery item");
  await page.evaluate(() => { (window as Window & { failCanvasEncoding?: boolean }).failCanvasEncoding = true; });
  await page.getByRole("button", { name: "Редактировать" }).click();
  const editor = page.getByRole("dialog", { name: "Обрезать фотографию" });
  await editor.getByRole("button", { name: "Подтвердить кадр" }).click();
  await expect(editor.getByRole("alert")).toBeVisible();
  await editor.getByRole("button", { name: "Продолжить без кадрирования" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Фото сохранено" })).toBeVisible();
  const recoveredSavedUrl = await page.locator(".photo-viewer-image img.detail-photo").getAttribute("src");
  expect(recoveredSavedUrl).toBeTruthy();

  await page.getByRole("button", { name: "Заменить фото" }).click();
  await page.locator('input[name="photo"]').setInputFiles({ name: "broken.png", mimeType: "image/png", buffer: Buffer.from("not an image") });
  const fallback = page.getByRole("button", { name: "Продолжить без кадрирования" });
  await expect(fallback).toBeVisible();
  await fallback.click();
  await expect(page.locator(".photo-replacement-form [role='alert']")).toBeVisible();
  await page.reload();
  await expect(page.locator(".photo-viewer-image img.detail-photo")).toHaveAttribute("src", recoveredSavedUrl!);
  await expect.poll(() => page.locator(".photo-viewer-image img.detail-photo").evaluate((element) => (element as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
});
