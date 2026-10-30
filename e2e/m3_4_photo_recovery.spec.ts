import { expect, test, type Locator } from "@playwright/test";
import sharp from "sharp";
import { messages, locales } from "../src/i18n/messages";

const base = "/inventories/00000000-0000-4000-8000-000000000001";
async function setCrop(editor: Locator, rect: { x: number; y: number; width: number; height: number }) {
  await editor.locator(".photo-cropper-widget").evaluate((root, data) => {
    const image = root.querySelector(":scope > img") as HTMLImageElement & { cropper: { setData(data: unknown): void } };
    image.cropper.setData(data);
  }, rect);
}
async function dimensions(dialog: Locator) {
  return dialog.locator('input[name="photo"]').evaluate(async el => {
    const image = await createImageBitmap((el as HTMLInputElement).files![0]!);
    const value = { width: image.width, height: image.height }; image.close(); return value;
  });
}

test("invalid short crop recovers, repeated source edits and recovered drafts retain accepted pixels", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto(base); await page.locator(".add-dialog-trigger").click();
  let dialog = page.getByRole("dialog", { name: messages.ru.addItem });
  const source = await sharp({ create: { width: 800, height: 600, channels: 3, background: "#54947c" } }).png().toBuffer();
  await dialog.locator('input[name="photo"]').setInputFiles({ name: "synthetic-source.png", mimeType: "image/png", buffer: source });
  let editor = page.getByRole("dialog", { name: messages.ru.cropTitle });
  await expect(editor.getByRole("button", { name: messages.ru.cropConfirm })).toBeEnabled();
  await setCrop(editor, { x: 100, y: 100, width: 300, height: 20 });
  await editor.getByRole("button", { name: messages.ru.cropConfirm }).click();
  await expect(editor.getByRole("alert")).toContainText(messages.ru.cropTooSmall);
  await expect(editor.getByRole("combobox", { name: messages.ru.cropAspect, exact: true })).toBeEnabled();
  await editor.getByText(messages.ru.cropKeyboardControls, { exact: true }).click();
  await expect(editor.getByRole("button", { name: messages.ru.cropGrowHeight, exact: true })).toBeEnabled();
  await setCrop(editor, { x: 100, y: 100, width: 300, height: 200 });
  await expect(editor.getByRole("button", { name: messages.ru.cropConfirm })).toBeEnabled();
  await editor.getByRole("button", { name: messages.ru.cropGrowHeight, exact: true }).focus();
  await page.keyboard.press("Enter");
  await editor.getByRole("button", { name: messages.ru.cropConfirm }).click();
  expect(await dimensions(dialog)).toEqual({ width: 300, height: 208 });
  await expect(dialog.locator(".photo-file-caption")).toHaveCount(0);
  await dialog.getByRole("button", { name: messages.ru.editCrop, exact: true }).click();
  editor = page.getByRole("dialog", { name: messages.ru.cropTitle });
  await expect(editor.getByRole("button", { name: messages.ru.cropConfirm })).toBeEnabled();
  await setCrop(editor, { x: 20, y: 20, width: 500, height: 400 });
  await editor.locator(".crop-actions").getByRole("button", { name: messages.ru.cancel, exact: true }).click();
  expect(await dimensions(dialog)).toEqual({ width: 300, height: 208 });
  await page.waitForFunction(() => new Promise<boolean>(resolve => {
    const open = indexedDB.open("all-items-drafts", 1);
    open.onsuccess = () => { const db = open.result; const q = db.transaction("drafts").objectStore("drafts").getAll(); q.onsuccess = () => { resolve(q.result.some(r => r.photo?.selected && !r.photo.pending)); db.close(); }; };
  }));
  await page.reload(); await page.locator(".add-dialog-trigger").click();
  dialog = page.getByRole("dialog", { name: messages.ru.addItem });
  await dialog.getByRole("button", { name: messages.ru.draftRestore }).click();
  expect(await dimensions(dialog)).toEqual({ width: 300, height: 208 });
  await dialog.getByRole("button", { name: messages.ru.editCrop, exact: true }).click();
  editor = page.getByRole("dialog", { name: messages.ru.cropTitle });
  await expect(editor.getByRole("button", { name: messages.ru.cropConfirm })).toBeEnabled();
  await setCrop(editor, { x: 10, y: 10, width: 600, height: 400 });
  await page.evaluate(() => { const original = HTMLCanvasElement.prototype.toBlob; HTMLCanvasElement.prototype.toBlob = function() { HTMLCanvasElement.prototype.toBlob = original; throw new Error("Synthetic canvas failure"); }; });
  await editor.getByRole("button", { name: messages.ru.cropConfirm }).click();
  await expect(editor.getByRole("alert")).toContainText(messages.ru.cropFailed);
  await expect(editor.getByRole("button", { name: messages.ru.cropConfirm })).toBeEnabled();
  await editor.getByRole("button", { name: messages.ru.cropConfirm }).click();
  expect(await dimensions(dialog)).toEqual({ width: 600, height: 400 });
  await dialog.getByLabel(messages.ru.itemName, { exact: true }).fill("M3.4 recovered crop");
  await dialog.getByRole("button", { name: messages.ru.saveItem, exact: true }).click();
  await expect(page).toHaveURL(/added=/);
  await page.getByRole("link", { name: "M3.4 recovered crop", exact: true }).click();
  const src = await page.locator(".photo-viewer-image img").getAttribute("src");
  const saved = await sharp(await (await page.request.get(src!)).body()).metadata();
  expect({ width: saved.width, height: saved.height }).toEqual({ width: 600, height: 400 });
});

test("photo-only names and crop validation follow the locale without rewriting literal titles", async ({ page, context }) => {
  test.setTimeout(180_000);
  const image = await sharp({ create: { width: 300, height: 200, channels: 3, background: "#ae7953" } }).png().toBuffer();
  let savedId = "";
  for (const locale of ["en", ...locales.filter(l => l !== "en")]) {
    await context.addCookies([{ name: "all-items-language", value: locale, url: "http://127.0.0.1:3100" }]);
    await page.goto(base); await page.locator(".add-dialog-trigger").click();
    const copy = messages[locale as keyof typeof messages];
    const dialog = page.getByRole("dialog", { name: copy.addItem });
    await dialog.locator('input[name="photo"]').setInputFiles({ name: "synthetic.png", mimeType: "image/png", buffer: image });
    const editor = page.getByRole("dialog", { name: copy.cropTitle });
    await expect(editor.getByRole("button", { name: copy.cropConfirm })).toBeEnabled();
    await setCrop(editor, { x: 20, y: 20, width: 100, height: 10 });
    await editor.getByRole("button", { name: copy.cropConfirm }).click();
    await expect(editor.getByRole("alert")).toContainText(copy.cropTooSmall);
    await setCrop(editor, { x: 20, y: 20, width: 200, height: 100 });
    await expect(editor.getByRole("button", { name: copy.cropConfirm })).toBeEnabled();
    await editor.getByRole("button", { name: copy.cropConfirm }).click();
    if (locale === "en") {
      await dialog.getByRole("button", { name: copy.saveItem, exact: true }).click();
      await expect(page).toHaveURL(/added=/); savedId = new URL(page.url()).searchParams.get("added")!;
    } else {
      await dialog.getByRole("button", { name: copy.removeSelection, exact: true }).click();
      await dialog.getByRole("button", { name: copy.close, exact: true }).first().click();
      await expect.poll(() => page.evaluate(() => new Promise<number>(resolve => { const open = indexedDB.open("all-items-drafts", 1); open.onsuccess = () => { const db = open.result; const q = db.transaction("drafts").objectStore("drafts").count(); q.onsuccess = () => { resolve(q.result); db.close(); }; }; }))).toBe(0);
    }
    await page.goto(`${base}/items/${savedId}`);
    await expect(page.locator("h1")).toHaveText(copy.unidentifiedItemName);
    await expect(page.locator('input[name="name"]')).toHaveValue("");
  }
  await page.locator('input[name="name"]').fill("Unidentified item");
  await page.getByRole("button", { name: messages["zh-Hans"].saveChanges, exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`${base}$`));
  await context.addCookies([{ name: "all-items-language", value: "ru", url: "http://127.0.0.1:3100" }]);
  await page.goto(`${base}/items/${savedId}`);
  await expect(page.locator("h1")).toHaveText("Unidentified item");
});
