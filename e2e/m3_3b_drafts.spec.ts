import { chromium, expect, test, type BrowserContext, type Page } from "@playwright/test";
import sharp from "sharp";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const base = "/inventories/00000000-0000-4000-8000-000000000001";
async function draftCount(page: Page) {
  return page.evaluate(() => new Promise<number>((resolve, reject) => {
    const open = indexedDB.open("all-items-drafts", 1);
    open.onerror = () => reject(open.error);
    open.onsuccess = () => { const db = open.result; const request = db.transaction("drafts").objectStore("drafts").count(); request.onsuccess = () => { resolve(request.result); db.close(); }; request.onerror = () => reject(request.error); };
  }));
}

test("restores and discards a scoped item draft including the cropped photo", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto(base);
  await page.locator(".add-dialog-trigger").click();
  let dialog = page.getByRole("dialog", { name: "Добавить вещь" });
  await dialog.getByLabel("Название").fill("Synthetic recovered item");
  await dialog.getByLabel("Модель").fill("Draft model");
  await dialog.locator(".category-trigger").click();
  await dialog.locator('.category-options input[type="checkbox"]').first().check();
  await dialog.getByLabel("Своя категория").fill("Recovered category");
  await dialog.getByLabel("Эмодзи категории").fill("🧰");
  await dialog.getByRole("button", { name: "Добавить", exact: true }).click();
  await dialog.locator(".category-trigger").click();
  await dialog.getByRole("button", { name: "Добавить фото", exact: true }).click();
  await dialog.locator('input[name="photo"]').setInputFiles({ name: "synthetic.png", mimeType: "image/png", buffer: await sharp({ create: { width: 180, height: 300, channels: 3, background: "#638798" } }).png().toBuffer() });
  await page.getByRole("dialog", { name: "Редактировать фото" }).getByRole("button", { name: "Готово" }).click();
  await expect.poll(() => draftCount(page)).toBe(1);
  await expect.poll(() => page.evaluate(() => new Promise<boolean>((resolve, reject) => { const open = indexedDB.open("all-items-drafts", 1); open.onerror = () => reject(open.error); open.onsuccess = () => { const db = open.result; const q = db.transaction("drafts").objectStore("drafts").getAll(); q.onsuccess = () => { resolve(Boolean(q.result[0]?.photo?.selected)); db.close(); }; }; }))).toBe(true);
  await page.reload();
  await page.locator(".add-dialog-trigger").click();
  dialog = page.getByRole("dialog", { name: "Добавить вещь" });
  await expect(dialog.getByText("Найден черновик")).toBeVisible();
  await dialog.getByRole("button", { name: "Восстановить" }).click();
  await expect(dialog.getByLabel("Название")).toHaveValue("Synthetic recovered item");
  await expect(dialog.getByLabel("Модель")).toHaveValue("Draft model");
  await expect(dialog.locator(".category-selection")).toContainText("Recovered category");
  await expect(dialog.locator(".category-selection")).toContainText("🧰");
  await expect(dialog.locator(".photo-preview-frame img")).toBeVisible();
  expect(await dialog.locator('input[name="photo"]').evaluate(el => (el as HTMLInputElement).files?.[0]?.size)).toBeGreaterThan(0);
  await dialog.getByRole("button", { name: "Сохранить вещь", exact: true }).click();
  await expect(page).toHaveURL(/added=/, { timeout: 30_000 });
  await expect.poll(() => draftCount(page)).toBe(0);
  await page.reload();
  await page.locator(".add-dialog-trigger").click();
  dialog = page.getByRole("dialog", { name: "Добавить вещь" });
  await expect(dialog.getByText("Найден черновик")).toHaveCount(0);
  await dialog.getByLabel("Название").fill("Discard me");
  await expect.poll(() => draftCount(page)).toBe(1);
  await page.reload();
  await page.locator(".add-dialog-trigger").click();
  await page.getByRole("button", { name: "Удалить черновик" }).click();
  await expect.poll(() => draftCount(page)).toBe(0);
});

test("does not overwrite a newer draft from another tab", async ({ context, page }) => {
  await page.goto(base);
  await page.locator(".add-dialog-trigger").click();
  await page.getByLabel("Название").fill("First tab");
  await expect.poll(() => draftCount(page)).toBe(1);
  const other = await context.newPage(); await other.goto(base); await other.locator(".add-dialog-trigger").click();
  await other.getByRole("button", { name: "Восстановить" }).click();
  await other.getByLabel("Название").fill("Newer tab");
  await expect.poll(() => other.evaluate(() => new Promise<string>((resolve, reject) => { const open = indexedDB.open("all-items-drafts", 1); open.onerror = () => reject(open.error); open.onsuccess = () => { const db = open.result; const q = db.transaction("drafts").objectStore("drafts").getAll(); q.onsuccess = () => { resolve(q.result[0]?.fields.name); db.close(); }; }; }))).toBe("Newer tab");
  await page.getByLabel("Название").fill("Older tab");
  await expect(page.getByRole("alert").filter({ hasText: "другой вкладке" })).toBeVisible();
  await other.reload(); await other.locator(".add-dialog-trigger").click(); await other.getByRole("button", { name: "Восстановить" }).click();
  await expect(other.getByLabel("Название")).toHaveValue("Newer tab");
});

test("empty and whitespace-only forms are not stored", async ({ page }) => {
  await page.goto(base); await page.locator(".add-dialog-trigger").click();
  await page.getByLabel("Название").fill("   ");
  await expect.poll(() => draftCount(page)).toBe(0);
  await page.reload(); await page.locator(".add-dialog-trigger").click();
  await expect(page.getByText("Найден черновик")).toHaveCount(0);
});

test("restores a selected photo that was still awaiting cropping", async ({ page }) => {
  await page.goto(base); await page.locator(".add-dialog-trigger").click();
  const dialog = page.getByRole("dialog", { name: "Добавить вещь" });
  await dialog.getByRole("button", { name: "Добавить фото", exact: true }).click();
  await dialog.locator('input[name="photo"]').setInputFiles({ name: "pending.png", mimeType: "image/png", buffer: await sharp({ create: { width: 120, height: 160, channels: 3, background: "#668899" } }).png().toBuffer() });
  await expect(page.getByRole("dialog", { name: "Редактировать фото" })).toBeVisible();
  await expect.poll(() => draftCount(page)).toBe(1);
  await page.reload(); await page.locator(".add-dialog-trigger").click();
  await page.getByRole("button", { name: "Восстановить" }).click();
  await expect(page.getByRole("dialog", { name: "Редактировать фото" })).toBeVisible();
  await page.getByRole("dialog", { name: "Редактировать фото" }).getByRole("button", { name: "Отмена" }).last().click();
  await expect.poll(() => draftCount(page)).toBe(0);
});

test("a committed draft with a photo survives a browser restart", async () => {
  test.setTimeout(120_000);
  const profile = await mkdtemp(path.join(os.tmpdir(), "all-items-draft-profile-"));
  let context: BrowserContext | undefined;
  const launch = () => chromium.launchPersistentContext(profile, { channel: "msedge", headless: true, locale: "ru-RU", baseURL: "http://127.0.0.1:3100" });
  try {
    context = await launch(); let page = await context.newPage();
    await page.goto(base); await page.locator(".add-dialog-trigger").click();
    const dialog = page.getByRole("dialog", { name: "Добавить вещь" });
    await dialog.getByLabel("Название").fill("Restart recovery synthetic");
    await dialog.getByRole("button", { name: "Добавить фото", exact: true }).click();
    await dialog.locator('input[name="photo"]').setInputFiles({name:"restart.png",mimeType:"image/png",buffer:await sharp({create:{width:100,height:160,channels:3,background:"#567899"}}).png().toBuffer()});
    await page.getByRole("dialog", { name: "Редактировать фото" }).getByRole("button", { name: "Готово" }).click();
    await expect.poll(() => page.evaluate(() => new Promise<boolean>((resolve, reject) => { const open = indexedDB.open("all-items-drafts", 1); open.onerror = () => reject(open.error); open.onsuccess = () => { const db = open.result; const q = db.transaction("drafts").objectStore("drafts").getAll(); q.onsuccess = () => { resolve(Boolean(q.result[0]?.photo?.selected)); db.close(); }; }; }))).toBe(true);
    await context.close(); context = await launch(); page = await context.newPage();
    await page.goto(base); await page.locator(".add-dialog-trigger").click();
    await page.getByRole("button", { name: "Восстановить" }).click();
    await expect(page.getByLabel("Название")).toHaveValue("Restart recovery synthetic");
    await expect(page.locator(".photo-preview-frame img")).toBeVisible();
    expect(await page.locator('input[name="photo"]').evaluate(el => (el as HTMLInputElement).files?.[0]?.size)).toBeGreaterThan(0);
  } finally {
    await context?.close();
    if (path.dirname(path.resolve(profile)) !== path.resolve(os.tmpdir()) || !path.basename(profile).startsWith("all-items-draft-profile-")) throw new Error("Unexpected browser profile path");
    await rm(profile, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
  }
});

test("form remains usable when browser storage is denied", async ({ page }) => {
  await page.addInitScript(() => { Object.defineProperty(window, "indexedDB", { configurable: true, get() { throw new DOMException("Denied", "SecurityError"); } }); });
  await page.goto(base); await page.locator(".add-dialog-trigger").click();
  await expect(page.getByRole("alert").filter({ hasText: "черновик на этом устройстве" })).toBeVisible();
  await page.getByLabel("Название").fill("Still editable");
  await expect(page.getByLabel("Название")).toHaveValue("Still editable");
});

test("reports quota failures without losing form input", async ({ page }) => {
  await page.addInitScript(() => { IDBObjectStore.prototype.put = function () { throw new DOMException("Storage full", "QuotaExceededError"); }; });
  await page.goto(base); await page.locator(".add-dialog-trigger").click();
  await page.getByLabel("Название").fill("Kept after quota error");
  await expect(page.getByRole("alert").filter({ hasText: "черновик на этом устройстве" })).toBeVisible();
  await expect(page.getByLabel("Название")).toHaveValue("Kept after quota error");
});

test("drafts stay isolated when switching inventories", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto(base); await page.locator(".add-dialog-trigger").click();
  await page.getByLabel("Название").fill("Home draft synthetic");
  await expect.poll(() => draftCount(page)).toBe(1);
  await page.getByRole("dialog", { name: "Добавить вещь" }).getByRole("button", { name: "Закрыть", exact: true }).first().click();
  await page.locator(".inventory-switcher > button").click();
  await page.getByRole("menuitem", { name: "Создать инвентарь" }).click();
  const create = page.getByRole("dialog", { name: "Создать инвентарь" });
  await create.getByLabel("Название инвентаря").fill("Draft isolation synthetic");
  await create.getByRole("button", { name: "Создать инвентарь", exact: true }).click();
  await expect(page).not.toHaveURL(new RegExp(`${base}$`));
  const secondUrl = page.url();
  await page.locator(".add-dialog-trigger").click();
  await expect(page.getByText("Найден черновик")).toHaveCount(0);
  await page.getByLabel("Название").fill("Second draft synthetic");
  await expect.poll(() => draftCount(page)).toBe(2);
  await page.goto(base); await page.locator(".add-dialog-trigger").click();
  await page.getByRole("button", { name: "Восстановить" }).click();
  await expect(page.getByLabel("Название")).toHaveValue("Home draft synthetic");
  await page.goto(secondUrl); await page.locator(".add-dialog-trigger").click();
  await page.getByRole("button", { name: "Восстановить" }).click();
  await expect(page.getByLabel("Название")).toHaveValue("Second draft synthetic");
});
