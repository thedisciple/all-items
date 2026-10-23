import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import sharp from "sharp";
import { verifyInventoryArchive } from "../src/export/archive";
import { previewInventoryArchive } from "../src/export/import";

test("downloads a complete archive and restores it through the browser into a fresh installation", async ({ page }) => {
  test.setTimeout(120_000);
  const image = await sharp({ create: { width: 260, height: 180, channels: 3, background: "#678853" } }).png().toBuffer();
  const cover = await sharp({ create: { width: 400, height: 200, channels: 3, background: "#68639a" } }).png().toBuffer();

  await page.goto("/");
  await page.locator(".add-dialog-trigger").click();
  const add = page.getByRole("dialog", { name: "Добавить вещь" });
  await add.getByRole("button", { name: "Добавить фото" }).click();
  await page.locator('input[name="photo"]').setInputFiles({ name: "synthetic.png", mimeType: "image/png", buffer: image });
  await page.getByRole("dialog", { name: "Редактировать фото" }).getByRole("button", { name: "Готово" }).click();
  await add.getByLabel("Название").fill("Restored gadget 中文");
  await add.locator(".category-picker summary").click();
  await add.locator(".category-options input").nth(0).check();
  await add.locator(".category-options input").nth(2).check();
  await add.getByRole("button", { name: "Добавить вещь" }).click();
  await expect(page).toHaveURL(/added=/);

  await page.goto("/collections");
  await page.getByRole("button", { name: "Создать коллекцию" }).click();
  const create = page.getByRole("dialog", { name: "Создать коллекцию" });
  await create.getByLabel("Название коллекции").fill("Portable DIY");
  await create.getByRole("button", { name: "Создать коллекцию" }).click();
  await expect(page).toHaveURL(/\/collections\/[0-9a-f-]+$/);
  await page.getByRole("button", { name: "Добавить вещи" }).click();
  const membership = page.getByRole("dialog", { name: "Добавить вещи" });
  await membership.locator(".collection-item-option").filter({ hasText: "Restored gadget 中文" }).getByRole("checkbox").check();
  await membership.getByRole("button", { name: /Добавить вещи/ }).click();
  await expect(page.locator(".item-row").filter({ hasText: "Restored gadget 中文" })).toBeVisible();
  await page.getByRole("button", { name: "Изменить обложку" }).click();
  const coverDialog = page.getByRole("dialog", { name: "Обложка коллекции" });
  await coverDialog.getByLabel("Обложка коллекции").selectOption("upload");
  await coverDialog.locator('input[type="file"]').setInputFiles({ name: "synthetic-cover.png", mimeType: "image/png", buffer: cover });
  await expect(coverDialog.getByRole("img", { name: "Предпросмотр обложки" })).toBeVisible();
  await coverDialog.getByRole("button", { name: "Сохранить обложку" }).click();
  await expect(page.locator(".collection-detail-cover")).toBeVisible();

  await page.goto("/data");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Скачать архив" }).click();
  const download = await downloadPromise;
  const archivePath = await download.path();
  if (!archivePath) throw new Error("The test archive was not downloaded.");
  const archive = new Uint8Array(await readFile(archivePath));
  expect(verifyInventoryArchive(archive).version).toBe(3);
  expect((await previewInventoryArchive(archive)).items).toBe(1);

  await page.goto("http://127.0.0.1:3103/data");
  await expect(page.getByRole("button", { name: "Импортировать архив" })).toBeVisible();
  const previewRequest = page.waitForRequest("**/api/import/preview");
  await page.locator('.import-panel input[type="file"]').setInputFiles({ name: "portable.zip", mimeType: "application/zip", buffer: Buffer.from(archive) });
  const sent = await previewRequest;
  expect(sent.headers()["x-all-items-import"]).toBe("1");
  expect(sent.headers()["content-type"]).toBe("application/zip");
  await expect(page.getByRole("heading", { name: "Содержимое архива" })).toBeVisible();
  await expect(page.locator(".import-summary")).toContainText("Вещей: 1");
  await expect(page.locator(".import-summary")).toContainText("Коллекций: 1");
  await expect(page.locator(".import-summary")).toContainText("Фото: 1");
  await page.getByRole("button", { name: "Импортировать", exact: true }).click();
  await expect(page).toHaveURL("http://127.0.0.1:3103/");
  await page.getByRole("link", { name: /Restored gadget 中文/ }).click();
  await expect(page.getByRole("heading", { name: "Restored gadget 中文", level: 1 })).toBeVisible();
  await expect(page.locator(".item-summary .category-chip")).toHaveCount(2);
  await expect.poll(() => page.locator(".detail-photo").first().evaluate((image) => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  await page.goto("http://127.0.0.1:3103/collections");
  await page.locator(".collection-card").filter({ hasText: "Portable DIY" }).click();
  await expect(page.locator(".item-row").filter({ hasText: "Restored gadget 中文" })).toBeVisible();
  await expect.poll(() => page.locator(".collection-detail-cover").evaluate((image) => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);

  await page.goto("http://127.0.0.1:3103/");
  await page.locator(".add-dialog-trigger").click();
  const nextItem = page.getByRole("dialog", { name: "Добавить вещь" });
  await nextItem.getByLabel("Название").fill("After restore");
  await nextItem.getByRole("button", { name: "Добавить вещь" }).click();
  await expect(page.getByRole("link", { name: /After restore/ })).toContainText("INV-000002");

  await page.goto("http://127.0.0.1:3103/data");
  await page.locator('.import-panel input[type="file"]').setInputFiles({ name: "portable.zip", mimeType: "application/zip", buffer: Buffer.from(archive) });
  await expect(page.getByRole("heading", { name: "Содержимое архива" })).toBeVisible();
  await page.getByRole("button", { name: "Импортировать", exact: true }).click();
  await expect(page.locator(".import-panel [role='alert']")).toContainText("Для импорта нужен пустой инвентарь");
});
