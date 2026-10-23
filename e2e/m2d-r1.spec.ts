import { expect, test, type Page } from "@playwright/test";
import sharp from "sharp";

async function syntheticPhoto(width = 640, height = 480) {
  return sharp({ create: { width, height, channels: 3, background: { r: 85, g: 125, b: 165 } } })
    .composite([{ input: Buffer.from(`<svg width="${width}" height="${height}"><rect x="24" y="24" width="${width - 48}" height="${height - 48}" fill="none" stroke="#c5f36b" stroke-width="18"/><circle cx="${width / 2}" cy="${height / 2}" r="70" fill="#f5ba67"/></svg>`) }])
    .png().toBuffer();
}

async function readCropState(page: Page) {
  return page.locator(".photo-cropper-widget").evaluate((root) => {
    const image = root.querySelector<HTMLImageElement>(":scope > img") as (HTMLImageElement & { cropper?: { getImageData: () => { width: number; height: number }; getData: () => { rotate?: number }; getCropBoxData: () => { left: number; top: number; width: number; height: number }; getCanvasData: () => { left: number; top: number; width: number; height: number } } }) | null;
    const instance = image?.cropper;
    if (!instance) throw new Error("Cropper instance is not attached to the image");
    return { image: instance.getImageData(), rotation: instance.getData().rotate ?? 0, cropBox: instance.getCropBoxData(), canvas: instance.getCanvasData() };
  });
}

async function selectPhoto(page: Page, name = "synthetic.png", buffer?: Buffer) {
  buffer ??= await syntheticPhoto();
  await page.getByRole("button", { name: "Добавить фото" }).click();
  await page.locator('input[name="photo"]').setInputFiles({ name, mimeType: "image/png", buffer });
  const editor = page.getByRole("dialog", { name: "Редактировать фото" });
  await expect(editor.getByRole("button", { name: "Готово" })).toBeEnabled();
  return editor;
}

async function createWithCrop(page: Page, name: string) {
  await page.goto("/");
  await page.locator(".add-dialog-trigger").click();
  const addDialog = page.getByRole("dialog", { name: "Добавить вещь" });
  const editor = await selectPhoto(page);
  const closeBox = await editor.locator(".crop-close-button").boundingBox();
  const closeIconBox = await editor.locator(".crop-close-button svg").boundingBox();
  expect(closeBox && closeIconBox).toBeTruthy();
  expect(Math.abs((closeIconBox!.x + closeIconBox!.width / 2) - (closeBox!.x + closeBox!.width / 2))).toBeLessThan(1);
  expect(Math.abs((closeIconBox!.y + closeIconBox!.height / 2) - (closeBox!.y + closeBox!.height / 2))).toBeLessThan(1);
  await page.setViewportSize({ width: 360, height: 800 });
  await expect(editor.getByRole("button", { name: "Готово" })).toBeInViewport();
  await expect(editor.locator(".crop-actions").getByRole("button", { name: "Отмена" })).toBeInViewport();
  await page.setViewportSize({ width: 360, height: 640 });
  await editor.locator(".crop-accessibility-controls summary").click();
  await editor.locator(".crop-nudge-button").first().click();
  await expect(editor.getByRole("button", { name: "Готово" })).toBeInViewport();
  await expect(editor.locator(".crop-actions").getByRole("button", { name: "Отмена" })).toBeInViewport();
  await page.setViewportSize({ width: 1024, height: 768 });
  await expect(editor.getByRole("button", { name: "Готово" })).toBeInViewport();
  await page.setViewportSize({ width: 1365, height: 500 });
  await expect(editor.getByRole("button", { name: "Готово" })).toBeInViewport();
  await page.setViewportSize({ width: 1365, height: 900 });
  await editor.getByRole("button", { name: "Готово" }).click();
  await addDialog.getByLabel("Название").fill(name);
  await addDialog.getByRole("button", { name: "Добавить вещь" }).click();
  await expect(page).toHaveURL(/added=/);
  await page.getByRole("link", { name: new RegExp(name) }).click();
  await expect(page.locator(".photo-viewer-image img")).toBeVisible();
}

async function createNoPhotoItem(page: Page, name: string, category: string) {
  await page.goto("/");
  await page.locator(".add-dialog-trigger").click();
  const dialog = page.getByRole("dialog", { name: "Добавить вещь" });
  await dialog.getByLabel("Название").fill(name);
  if (category === "custom") {
    await dialog.getByLabel("Категория").selectOption("__custom");
    await dialog.getByLabel("Своя категория").fill("Electronics");
  } else await dialog.getByLabel("Категория").selectOption(category);
  await dialog.getByRole("button", { name: "Добавить вещь" }).click();
  await expect(page).toHaveURL(/added=/);
}

test("waits for image readiness, applies zoom and aspect controls, crops, and opens a compact photo viewer", async ({ page }) => {
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];
  const consoleWarnings: string[] = [];
  const failedResponses: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(`${message.text()} (${message.location().url}:${message.location().lineNumber})`); if (message.type() === "warning") consoleWarnings.push(message.text()); });
  page.on("response", (response) => { if (response.status() >= 400) failedResponses.push(`${response.status()} ${response.url()}`); });
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
  await expect(editor.locator(".crop-zoom output")).toHaveText("× 1,65");
  await expect.poll(async () => (await readCropState(page)).image.width).toBeGreaterThan(stateBeforeZoom.image.width * 1.25);
  const beforeWheelZoom = (await readCropState(page)).image.width;
  const imageBounds = await editor.locator(".cropper-canvas").boundingBox();
  expect(imageBounds).not.toBeNull();
  await page.mouse.move(imageBounds!.x + imageBounds!.width / 2, imageBounds!.y + imageBounds!.height / 2);
  await page.mouse.wheel(0, -120);
  await expect.poll(async () => (await readCropState(page)).image.width).toBeGreaterThan(beforeWheelZoom);

  const aspect = editor.getByLabel("Формат кадра");
  await aspect.selectOption("original");
  const originalFrame = await readCropState(page);
  expect(Math.abs(originalFrame.cropBox.width / originalFrame.cropBox.height - 4 / 3)).toBeLessThan(0.03);
  expect(Math.abs(originalFrame.cropBox.width - originalFrame.canvas.width)).toBeLessThan(2);
  expect(Math.abs(originalFrame.cropBox.height - originalFrame.canvas.height)).toBeLessThan(2);
  await editor.getByRole("button", { name: "Повернуть по часовой стрелке на 90°" }).click();
  await expect.poll(async () => (await readCropState(page)).rotation).toBe(90);
  const rotatedOriginalFrame = await readCropState(page);
  expect(Math.abs(rotatedOriginalFrame.cropBox.width / rotatedOriginalFrame.cropBox.height - 3 / 4)).toBeLessThan(0.05);
  expect(Math.abs(rotatedOriginalFrame.cropBox.width - rotatedOriginalFrame.canvas.width)).toBeLessThan(2);
  expect(Math.abs(rotatedOriginalFrame.cropBox.height - rotatedOriginalFrame.canvas.height)).toBeLessThan(2);
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
  await page.mouse.move(handleBounds!.x + handleBounds!.width / 2 - 28, handleBounds!.y + handleBounds!.height / 2 - 18, { steps: 5 });
  await page.mouse.up();
  await expect.poll(async () => (await readCropState(page)).cropBox.width).not.toBeCloseTo(boxBeforeResize.width, 0);
  await editor.getByRole("button", { name: "Сбросить правки" }).click();
  await expect.poll(async () => (await readCropState(page)).rotation).toBe(0);
  await expect(aspect).toHaveValue("free");
  await editor.getByRole("button", { name: "Готово" }).click();
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

  await page.getByRole("button", { name: "Язык" }).click();
  const languageMenu = page.getByRole("menu", { name: "Язык" });
  await expect(languageMenu.getByRole("menuitemradio", { name: "Русский" }).locator("img")).toHaveAttribute("src", "/flags/ru.svg");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "Edit" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Replace photo" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Language" })).toContainText("English");
  await page.getByRole("button", { name: "Language" }).click();
  await expect(page.getByRole("menuitemradio", { name: "English" }).locator("img")).toHaveAttribute("src", "/flags/gb.svg");
  expect(pageErrors).toEqual([]);
  expect(failedResponses).toEqual([]);
  expect(consoleErrors).toEqual([]);
  expect(consoleWarnings).toEqual([]);
});

test("deletes a saved photo immediately and allows a replacement without a reload", async ({ page }) => {
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
  await createWithCrop(page, "M2D-R2 delete and re-upload");
  const photo = page.locator(".photo-viewer-image img.detail-photo");
  await expect(photo).toBeVisible();
  await expect.poll(() => photo.evaluate((image) => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  consoleErrors.length = 0;
  await page.getByRole("button", { name: "Удалить фотографию" }).click();
  const confirmation = page.getByRole("alertdialog", { name: "Удалить фотографию" });
  await expect(confirmation.getByText(/Фотография будет удалена/)).toBeVisible();
  await confirmation.getByRole("button", { name: "Удалить фотографию" }).click();
  await expect(page.locator(".compact-photo-placeholder")).toBeVisible();
  await expect(page.locator(".photo-viewer-image img.detail-photo")).toHaveCount(0);
  await page.goto("/");
  const photoLessRow = page.getByRole("link", { name: /M2D-R2 delete and re-upload/ });
  await expect(photoLessRow.locator(".item-photo")).toHaveCount(0);
  await expect(photoLessRow.locator(".item-thumb")).toBeVisible();
  await photoLessRow.click();
  await page.getByRole("button", { name: "Добавить фото" }).click();
  await page.locator('input[name="photo"]').setInputFiles({ name: "replacement.png", mimeType: "image/png", buffer: await syntheticPhoto() });
  const editor = page.getByRole("dialog", { name: "Редактировать фото" });
  await editor.getByRole("button", { name: "Готово" }).click();
  await expect(page.locator(".photo-viewer-image img.detail-photo")).toBeVisible();
  await expect(page.locator(".photo-viewer-image img.detail-photo")).not.toHaveAttribute("src", /^blob:/);
  expect(pageErrors).toEqual([]);
  expect(consoleErrors).toEqual([]);
  await page.getByRole("button", { name: "Удалить вещь" }).click();
  const itemConfirmation = page.getByRole("alertdialog", { name: "Удалить вещь" });
  await itemConfirmation.getByRole("button", { name: "Удалить вещь" }).click();
  await expect(page).toHaveURL("/");
  await expect(page.getByRole("link", { name: /M2D-R2 delete and re-upload/ })).toHaveCount(0);
});

test("category and text filters update automatically and preserve browser history", async ({ page }) => {
  await createNoPhotoItem(page, "Zulu Stable", "electronics");
  await createNoPhotoItem(page, "Alpha Legacy", "custom");
  await createNoPhotoItem(page, "Middle Custom", "other");
  await page.getByRole("link", { name: /Zulu Stable/ }).click();
  await page.locator(".advanced-fields").locator("summary").click();
  await page.locator('select[name="trackingMode"]').selectOption("bulk");
  await page.locator('select[name="identificationStatus"]').selectOption("user_confirmed");
  await page.getByRole("button", { name: "Сохранить изменения" }).click();
  await expect(page).toHaveURL("/");
  await page.getByRole("link", { name: /Zulu Stable/ }).click();
  await page.locator('.stock-editor input[name="quantity"]').fill("7");
  await page.getByRole("button", { name: "Сохранить запас" }).click();
  await expect(page.locator('.stock-editor input[name="quantity"]')).toHaveValue("7");
  await page.goto("/");
  const filters = page.locator(".filter-bar");
  await expect.poll(async () => (await page.locator(".item-row h3").allTextContents()).filter((name) => /Alpha Legacy|Middle Custom|Zulu Stable/.test(name))).toEqual(["Middle Custom", "Alpha Legacy", "Zulu Stable"]);
  await filters.getByLabel("Категория").selectOption("electronics");
  await expect(page.locator(".item-row")).toHaveCount(2);
  await expect(page.locator(".item-list")).toContainText("Zulu Stable");
  await expect(page.locator(".item-list")).toContainText("Alpha Legacy");
  await filters.getByLabel("Любой статус").selectOption("user_confirmed");
  await expect(page.locator(".item-row")).toHaveCount(1);
  await expect(page.locator(".item-row")).toContainText("Zulu Stable");
  await filters.getByLabel("Любой статус").selectOption("");
  await expect(page.locator(".item-row")).toHaveCount(2);
  await filters.getByRole("searchbox").fill("Alpha");
  await expect(page.locator(".item-row")).toHaveCount(1);
  await expect(page.locator(".item-row")).toContainText("Alpha Legacy");
  await expect(page).toHaveURL(/category=electronics.*q=Alpha|q=Alpha.*category=electronics/);
  await page.goBack();
  await expect(page.locator(".item-row")).toHaveCount(2);
  await expect(filters.getByRole("searchbox")).toHaveValue("");
  await page.goForward();
  await expect(page.locator(".item-row")).toHaveCount(1);
  await filters.getByRole("button", { name: "Сбросить фильтры" }).click();
  await expect(page.locator(".item-row").filter({ hasText: /Alpha Legacy|Middle Custom|Zulu Stable/ })).toHaveCount(3);
  await filters.getByLabel("Сортировка").selectOption("name");
  await expect.poll(async () => (await page.locator(".item-row h3").allTextContents()).filter((name) => /Alpha Legacy|Middle Custom|Zulu Stable/.test(name))).toEqual(["Alpha Legacy", "Middle Custom", "Zulu Stable"]);

  await filters.getByLabel("Сортировка").selectOption("quantity");
  await expect.poll(async () => (await page.locator(".item-row h3").allTextContents()).filter((name) => /Alpha Legacy|Middle Custom|Zulu Stable/.test(name))[0]).toBe("Zulu Stable");

  await page.goto("/collections");
  await page.getByRole("button", { name: "Создать коллекцию" }).click();
  const dialog = page.getByRole("dialog", { name: "Создать коллекцию" });
  await dialog.getByLabel("Название коллекции").fill("Filter collection");
  await dialog.getByRole("button", { name: "Создать коллекцию" }).click();
  await expect(page).toHaveURL(/\/collections\/[0-9a-f-]+$/i);
  await page.getByRole("button", { name: "Добавить вещи" }).click();
  const picker = page.getByRole("dialog", { name: "Добавить вещи" });
  await picker.locator(".collection-item-option").filter({ hasText: "Zulu Stable" }).locator("input").check();
  await picker.locator(".collection-item-option").filter({ hasText: "Alpha Legacy" }).locator("input").check();
  await picker.getByRole("button", { name: /Добавить вещи/ }).click();
  await expect(page.locator(".collection-item-row")).toHaveCount(2);
  await page.locator(".filter-bar").getByLabel("Категория").selectOption("electronics");
  await expect(page.locator(".collection-item-row")).toHaveCount(2);
  await page.locator(".filter-bar").getByRole("searchbox").fill("Alpha");
  await expect(page.locator(".collection-item-row")).toHaveCount(1);
  await expect(page.locator(".collection-item-row")).toContainText("Alpha Legacy");
});

test("collection name, icon, cover and deletion are contextual and immediately visible", async ({ page }) => {
  await page.goto("/collections");
  await page.getByRole("button", { name: "Язык" }).click();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "Language" })).toContainText("English");
  await page.getByRole("button", { name: "Create collection" }).click();
  const createDialog = page.getByRole("dialog", { name: "Create collection" });
  await createDialog.getByLabel("Collection name").fill("Legacy collection");
  await createDialog.getByRole("button", { name: "Create collection" }).click();
  await expect(page).toHaveURL(/\/collections\/[0-9a-f-]+$/i);
  await expect(page.getByRole("heading", { name: "Legacy collection" })).toBeVisible();
  await page.getByRole("button", { name: "Edit collection" }).click();
  const renameForm = page.locator(".collection-rename-form");
  await expect(renameForm.getByLabel("Rename collection")).toBeFocused();
  await renameForm.getByLabel("Rename collection").fill("Renamed collection");
  await renameForm.getByRole("textbox", { name: "Collection icon" }).fill("📷");
  await renameForm.getByRole("button", { name: "Save name" }).click();
  await expect(page.locator(".collection-detail-heading h1")).toHaveText(/📷 Renamed collection/);
  await page.getByRole("button", { name: "Change cover" }).click();
  const coverDialog = page.getByRole("dialog", { name: "Collection cover" });
  await coverDialog.getByLabel("Collection cover").selectOption("emoji");
  await coverDialog.getByRole("textbox", { name: "Collection icon" }).fill("🔧");
  await coverDialog.getByRole("button", { name: "Save cover" }).click();
  await expect(page.locator(".collection-detail-cover-placeholder")).toContainText("🔧");
  await page.getByRole("link", { name: "Collections", exact: true }).click();
  const emojiCard = page.locator(".collection-card").filter({ hasText: "Renamed collection" });
  await expect(emojiCard.locator(".collection-card-placeholder")).toContainText("🔧");
  await expect(emojiCard.locator(".collection-title-icon")).toHaveCount(0);
  await emojiCard.click();
  await expect(page.locator(".collection-detail-cover-placeholder")).toContainText("🔧");
  await expect(page.locator(".collection-detail-heading h1")).toHaveText("Renamed collection");
  await page.getByRole("button", { name: "Change cover" }).click();
  const photoCoverDialog = page.getByRole("dialog", { name: "Collection cover" });
  await photoCoverDialog.getByLabel("Collection cover").selectOption("upload");
  await photoCoverDialog.locator('input[type="file"]').setInputFiles({ name: "collection-cover.png", mimeType: "image/png", buffer: await syntheticPhoto(640, 320) });
  await expect(photoCoverDialog.getByRole("img", { name: "Cover preview" })).toBeVisible();
  await photoCoverDialog.getByRole("button", { name: "Save cover" }).click();
  await expect(page.locator(".collection-detail-cover")).toBeVisible();
  await expect(page.locator(".collection-detail-cover")).toHaveAttribute("src", /media\/collections/);
  await expect.poll(() => page.locator(".collection-detail-cover").evaluate((image) => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  await page.getByRole("link", { name: "Collections", exact: true }).click();
  const renamedCard = page.locator(".collection-card").filter({ hasText: "Renamed collection" });
  await expect(renamedCard).toHaveCount(1);
  await expect(renamedCard.locator(".collection-card-image")).toBeVisible();
  await renamedCard.click();
  await page.getByRole("button", { name: "Delete collection" }).click();
  const confirmation = page.getByRole("alertdialog", { name: "Delete collection" });
  await expect(confirmation).toContainText("Items and photos will remain");
  await confirmation.getByRole("button", { name: "Delete collection" }).click();
  await expect(page).toHaveURL("/collections");
  await expect(page.locator(".collection-card").filter({ hasText: "Renamed collection" })).toHaveCount(0);
});

test("Original crop covers portrait source and rotated orientation", async ({ page }) => {
  await page.goto("/");
  await page.locator(".add-dialog-trigger").click();
  const addDialog = page.getByRole("dialog", { name: "Добавить вещь" });
  const editor = await selectPhoto(page, "portrait.png", await syntheticPhoto(480, 640));
  const aspect = editor.getByLabel("Формат кадра");
  await aspect.selectOption("original");
  let state = await readCropState(page);
  expect(Math.abs(state.cropBox.width / state.cropBox.height - 0.75)).toBeLessThan(0.04);
  expect(Math.abs(state.cropBox.width - state.canvas.width)).toBeLessThan(2);
  expect(Math.abs(state.cropBox.height - state.canvas.height)).toBeLessThan(2);
  await editor.getByRole("button", { name: "Повернуть по часовой стрелке на 90°" }).click();
  await expect.poll(async () => (await readCropState(page)).rotation).toBe(90);
  state = await readCropState(page);
  expect(Math.abs(state.cropBox.width / state.cropBox.height - 4 / 3)).toBeLessThan(0.05);
  expect(Math.abs(state.cropBox.width - state.canvas.width)).toBeLessThan(2);
  expect(Math.abs(state.cropBox.height - state.canvas.height)).toBeLessThan(2);
  await editor.getByRole("button", { name: "Отмена" }).last().click();
  await expect(addDialog).toBeVisible();
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
  await editor.getByRole("button", { name: "Готово" }).click();
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
  await page.getByRole("button", { name: "Редактировать фото" }).click();
  const editor = page.getByRole("dialog", { name: "Редактировать фото" });
  await editor.getByRole("button", { name: "Готово" }).click();
  await expect(editor.getByRole("alert")).toBeVisible();
  await editor.getByRole("button", { name: "Продолжить без кадрирования" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Фото сохранено" })).toBeAttached();
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
