import { expect, test, type Page } from "@playwright/test";
import sharp from "sharp";

const cases = [
  { locale: "ru", native: "Русский", title: "Все вещи", collection: "Коллекции", data: "Данные", download: "Скачать архив", csv: "Экспорт CSV", import: "Импортировать архив", inventoryType: "Тип учёта", categorySelect: "Выбрать категории", addPhoto: "Добавить фото", editTitle: "Редактировать фото", done: "Готово", cancel: "Отмена", close: "Закрыть" },
  { locale: "en", native: "English", title: "All Items", collection: "Collections", data: "Data", download: "Download archive", csv: "Export CSV", import: "Import archive", inventoryType: "Inventory type", categorySelect: "Choose categories", addPhoto: "Add photo", editTitle: "Edit photo", done: "Done", cancel: "Cancel", close: "Close" },
  { locale: "uk", native: "Українська", title: "Усі речі", collection: "Колекції", data: "Дані", download: "Завантажити архів", csv: "Експорт CSV", import: "Імпортувати архів", inventoryType: "Тип обліку", categorySelect: "Вибрати категорії", addPhoto: "Додати фото", editTitle: "Редагувати фото", done: "Готово", cancel: "Скасувати", close: "Закрити" },
  { locale: "sr-Latn", native: "Srpski", title: "Sve stvari", collection: "Kolekcije", data: "Podaci", download: "Preuzmi arhivu", csv: "Izvezi CSV", import: "Uvezi arhivu", inventoryType: "Tip inventara", categorySelect: "Izaberi kategorije", addPhoto: "Dodaj fotografiju", editTitle: "Uredi fotografiju", done: "Gotovo", cancel: "Otkaži", close: "Zatvori" },
  { locale: "zh-Hans", native: "简体中文", title: "全部物品", collection: "收藏集", data: "数据", download: "下载归档", csv: "导出 CSV", import: "导入归档", inventoryType: "库存类型", categorySelect: "选择类别", addPhoto: "添加照片", editTitle: "编辑照片", done: "完成", cancel: "取消", close: "关闭" },
];

async function chooseLocale(page: Page, native: string) {
  await page.locator(".language-switcher").click();
  await page.getByRole("menuitemradio", { name: native }).click();
}

test("five local languages render on inventory, details, collections, and photo editing without changing item data", async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto("/");
  await page.locator(".add-dialog-trigger").click();
  const addDialog = page.getByRole("dialog", { name: "Добавить вещь" });
  await addDialog.getByLabel("Название").fill("Мітка Srpski 中文");
  await addDialog.getByRole("button", { name: "Добавить вещь" }).click();
  await expect(page).toHaveURL(/added=/);
  const detailPath = await page.getByRole("link", { name: /Мітка Srpski 中文/ }).getAttribute("href");
  if (!detailPath?.startsWith("/items/")) throw new Error("The newly added item detail link was not found");

  for (const entry of cases) {
    await page.goto(detailPath);
    await chooseLocale(page, entry.native);
    await expect(page).toHaveURL(detailPath);
    await expect(page.getByRole("heading", { name: "Мітка Srpski 中文", level: 1 })).toBeVisible();
    await expect(page.getByLabel(entry.inventoryType)).toHaveValue("unique");
    await expect(page.locator(".category-picker summary")).toHaveText(entry.categorySelect);
    await expect(page.locator("html")).toHaveAttribute("lang", entry.locale);

    await page.goto("/");
    await expect(page.getByRole("heading", { name: entry.title, level: 1 })).toBeVisible();
    await page.goto("/collections");
    await expect(page.getByRole("heading", { name: entry.collection, level: 1 })).toBeVisible();
    await page.goto("/data");
    await expect(page.getByRole("heading", { name: entry.data, level: 1 })).toBeVisible();
    await expect(page.getByRole("button", { name: entry.download })).toBeVisible();
    await expect(page.getByRole("button", { name: entry.csv })).toBeVisible();
    await expect(page.getByRole("button", { name: entry.import })).toBeVisible();

    await page.goto("/");
    await page.locator(".add-dialog-trigger").click();
    const createDialog = page.getByRole("dialog");
    await createDialog.getByRole("button", { name: entry.addPhoto }).click();
    await page.locator('input[name="photo"]').setInputFiles({ name: "locale.png", mimeType: "image/png", buffer: await sharp({ create: { width: 240, height: 180, channels: 3, background: "#54708a" } }).png().toBuffer() });
    const photoDialog = page.getByRole("dialog", { name: entry.editTitle });
    await expect(photoDialog.getByRole("button", { name: entry.done })).toBeVisible();
    await photoDialog.locator(".crop-actions").getByRole("button", { name: entry.cancel }).click();
    await expect(createDialog).toBeVisible();
    await createDialog.locator(".dialog-actions").getByRole("button", { name: entry.close }).click();
  }

  await page.goto(detailPath);
  await expect(page.getByRole("heading", { name: "Мітка Srpski 中文", level: 1 })).toBeVisible();
});
