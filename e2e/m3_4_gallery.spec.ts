import { expect, test } from "./helpers/browser-reliability";
import type { Locator, Page } from "@playwright/test";
import sharp from "sharp";

const base = "/inventories/00000000-0000-4000-8000-000000000001";
async function upload(page: Page, form: Locator, color: string) {
  await form.locator('input[name="photo"]').setInputFiles({ name: "synthetic-gallery.png", mimeType: "image/png", buffer: await sharp({ create: { width: 400, height: 300, channels: 3, background: color } }).png().toBuffer() });
  const crop = page.getByRole("dialog", { name: "Редактировать фото" });
  await expect(crop.getByRole("button", { name: "Готово" })).toBeEnabled();
  await crop.getByRole("button", { name: "Готово" }).click();
}

test("three-photo gallery updates primary, order and one crop, then promotes a survivor", async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto(base); await page.locator(".add-dialog-trigger").click();
  const add = page.getByRole("dialog", { name: "Добавить вещь" });
  await add.getByLabel("Название", { exact: true }).fill("M3.4 three photos");
  await add.getByRole("button", { name: "Сохранить вещь", exact: true }).click();
  await expect(page).toHaveURL(/added=/);
  await page.getByRole("link", { name: "M3.4 three photos", exact: true }).click();
  await upload(page, page.locator(".photo-replacement-form").first(), "#a64d4d");
  await expect(page.locator(".gallery-thumbnail")).toHaveCount(1);
  const first = await page.locator(".gallery-thumbnail img").first().getAttribute("src");
  await upload(page, page.locator(".gallery-add"), "#4da66b");
  await expect(page.locator(".gallery-thumbnail")).toHaveCount(2);
  await upload(page, page.locator(".gallery-add"), "#4d68a6");
  await expect(page.locator(".gallery-thumbnail")).toHaveCount(3);
  await page.getByRole("button", { name: "Фото 2", exact: true }).click();
  const second = await page.locator('.gallery-thumbnail[aria-pressed="true"] img').getAttribute("src");
  await page.getByRole("button", { name: "Сделать основным", exact: true }).click();
  await expect(page.getByRole("button", { name: "Фото 2 — Основное фото", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Переместить раньше", exact: true }).click();
  await expect(page.getByRole("button", { name: "Фото 1 — Основное фото", exact: true })).toHaveAttribute("aria-pressed", "true");
  expect(await page.locator(".gallery-thumbnail img").first().getAttribute("src")).toBe(second);
  await page.locator(".photo-edit-primary").click();
  const crop = page.getByRole("dialog", { name: "Редактировать фото" });
  await expect(crop.getByRole("button", { name: "Готово" })).toBeEnabled();
  await crop.locator(".photo-cropper-widget").evaluate(root => {
    const img = root.querySelector(":scope > img") as HTMLImageElement & { cropper: { setData(data: unknown): void } };
    img.cropper.setData({ x: 40, y: 30, width: 240, height: 180 });
  });
  await crop.getByRole("button", { name: "Готово" }).click();
  await expect(page.locator(".gallery-thumbnail")).toHaveCount(3);
  await expect.poll(() => page.locator(".gallery-thumbnail img").first().getAttribute("src")).not.toBe(second);
  expect(await page.locator(".gallery-thumbnail img").nth(1).getAttribute("src")).toBe(first);
  const edited = await page.locator(".photo-viewer-image img").getAttribute("src");
  const metadata = await sharp(await (await page.request.get(edited!)).body()).metadata();
  expect([metadata.width, metadata.height]).toEqual([240, 180]);
  await page.goto(base);
  const row = page.locator(".item-row").filter({ has: page.getByRole("link", { name: "M3.4 three photos", exact: true }) });
  expect((await row.locator("img").getAttribute("src"))?.split("?")[0]).toBe(edited!.split("?")[0]);
  await row.getByRole("link", { name: "M3.4 three photos", exact: true }).click();
  await page.getByRole("button", { name: "Удалить фотографию", exact: true }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Удалить фотографию", exact: true }).click();
  await expect(page.locator(".gallery-thumbnail")).toHaveCount(2);
  await expect(page.getByRole("alertdialog")).toHaveCount(0);
  expect(await page.locator(".gallery-thumbnail img").first().getAttribute("src")).toBe(first);
  await expect(page.getByRole("button", { name: "Фото 1 — Основное фото", exact: true })).toBeVisible();
});
