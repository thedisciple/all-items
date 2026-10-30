import { expect, test } from "@playwright/test";
import { messages, locales } from "../src/i18n/messages";
import { suggestedCurrency } from "../src/items/currencies";
import { readInventoryArchive, verifyInventoryArchive } from "../src/export/archive";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";

const base = "/inventories/00000000-0000-4000-8000-000000000001";
const custom = "An unusually long custom category for components connectors and accessories";

test("filters and category chips remain bounded at every requested width in all five languages", async ({ page, context }) => {
  test.setTimeout(180_000);
  await page.goto(base); await page.locator(".add-dialog-trigger").click();
  const add = page.getByRole("dialog", { name: messages.ru.addItem });
  await add.getByLabel(messages.ru.itemName, { exact: true }).fill("M3.4 responsive categories");
  await add.locator(".category-trigger").click();
  for (const index of [0,1,2]) await add.locator('.category-options input[type="checkbox"]').nth(index).check();
  await add.getByLabel(messages.ru.customCategory, { exact: true }).fill(custom);
  await add.getByRole("button", { name: messages.ru.addCategory, exact: true }).click();
  await add.locator(".category-trigger").click();
  await add.getByRole("button", { name: messages.ru.saveItem, exact: true }).click();
  await expect(page).toHaveURL(/added=/);
  for (const locale of locales) {
    await context.addCookies([{ name: "all-items-language", value: locale, url: "http://127.0.0.1:3100" }]);
    await page.goto(`${base}?category=${encodeURIComponent(custom)}`);
    for (const width of [1440,1101,1099,761,759,561,559,360]) {
      await page.setViewportSize({ width, height: 900 });
      const row = page.locator(".item-row").filter({ hasText: "M3.4 responsive categories" });
      await expect(row).toBeVisible();
      const geometry = await row.evaluate(element => {
        const bounds = element.getBoundingClientRect();
        return [...element.querySelectorAll<HTMLElement>(".item-category-filter")].map(chip => { const r = chip.getBoundingClientRect(); return { height: r.height, left: r.left, right: r.right, rowLeft: bounds.left, rowRight: bounds.right, whiteSpace: getComputedStyle(chip).whiteSpace, title: chip.title, name: chip.getAttribute("aria-label") }; });
      });
      expect(geometry).toHaveLength(4);
      for (const chip of geometry) {
        expect(chip.height).toBe(30); expect(chip.whiteSpace).toBe("nowrap");
        expect(chip.left).toBeGreaterThanOrEqual(chip.rowLeft); expect(chip.right).toBeLessThanOrEqual(chip.rowRight);
        expect(chip.title).toBe(chip.name);
      }
      expect(await row.locator("a a, a button, button a").count()).toBe(0);
      const fit = await page.locator(".filter-bar").evaluate(element => {
        const r = element.getBoundingClientRect();
        return [...element.querySelectorAll("select,input,button")].every(control => { const b=control.getBoundingClientRect();return b.left>=r.left-1&&b.right<=r.right+1; });
      });
      expect(fit).toBe(true);
      const labelsFit = await page.locator(".filter-select").evaluateAll(elements => elements.every(element => { const label=element.querySelector("span")!,select=element.querySelector("select")!,text=label.textContent ?? ""; if(text.length>40)return true; const range=document.createRange();range.selectNodeContents(label);const width=range.getBoundingClientRect().width,style=getComputedStyle(select);return select.clientWidth-parseFloat(style.paddingLeft)-parseFloat(style.paddingRight)>=width-1; }));
      expect(labelsFit).toBe(true);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await expect(page.getByRole("combobox", { name: messages[locale].category, exact: true })).toHaveAttribute("title", custom);
      if (["ru","en"].includes(locale) && [1440,1099,759,360].includes(width)) await page.screenshot({ path: path.join(os.tmpdir(), `all-items-m34-${locale}-${width}.png`), fullPage: true });
    }
    await page.locator(".add-dialog-trigger").click();
    const draft = page.getByRole("dialog", { name: messages[locale].addItem });
    await draft.getByText(messages[locale].additionalDetails, { exact: true }).click();
    await expect(draft.locator('select[name="askingCurrency"]')).toHaveValue(suggestedCurrency(locale));
    await draft.getByRole("button", { name: messages[locale].close, exact: true }).first().click();
  }
});

test("sidebar keyboard preference, reduced motion and rounded dialog scrolling remain usable", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 }); await page.goto(base);
  const collapse = page.getByRole("button", { name: messages.ru.sidebarCollapse, exact: true });
  await collapse.focus(); await page.keyboard.press("Enter");
  await expect.poll(() => page.locator(".sidebar").evaluate(element => element.getBoundingClientRect().width)).toBe(72);
  await expect(page.locator(".brand-mark")).toBeVisible();
  await page.locator(".inventory-menu-trigger").click(); await expect(page.locator(".inventory-menu")).toBeVisible(); await page.keyboard.press("Escape");
  await page.locator(".side-navigation").getByRole("link", { name: /^Коллекции/ }).click();
  await expect(page).toHaveURL(/\/collections$/); await page.reload();
  await expect(page.locator(".sidebar")).toHaveAttribute("data-collapsed", "true");
  const html = await (await page.request.get(page.url())).text(); expect(html).toContain('data-collapsed="true"');
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.getByRole("button", { name: messages.ru.sidebarExpand, exact: true }).click();
  const durations = await page.locator(".sidebar").evaluate(element => getComputedStyle(element).transitionDuration.split(",").map(Number.parseFloat));
  expect(durations.every(value => value <= .001)).toBe(true);
  await page.goto(base); await page.setViewportSize({ width: 360, height: 520 });
  await page.locator(".add-dialog-trigger").click();
  const dialog = page.getByRole("dialog", { name: messages.ru.addItem });
  await dialog.getByLabel(messages.ru.itemName, { exact: true }).fill("M3.4 preserved modal");
  await dialog.getByText(messages.ru.additionalDetails, { exact: true }).click();
  const form = dialog.locator("form");
  expect(await form.evaluate(element => element.scrollHeight > element.clientHeight)).toBe(true);
  expect(await dialog.evaluate(element => getComputedStyle(element).overflow)).toBe("hidden");
  await form.evaluate(element => { element.scrollTop = element.scrollHeight; });
  await dialog.getByRole("button", { name: messages.ru.saveItem, exact: true }).focus();
  await expect(dialog.getByRole("button", { name: messages.ru.saveItem, exact: true })).toBeInViewport();
  await dialog.getByRole("button", { name: messages.ru.close, exact: true }).first().click();
  await page.locator(".add-dialog-trigger").click();
  await expect(dialog.getByLabel(messages.ru.itemName, { exact: true })).toHaveValue("M3.4 preserved modal");
});

test("manual currency survives language, save, edit and archive restore; blank prices store no currency", async ({ page, context }) => {
  test.setTimeout(180_000);
  await context.addCookies([{ name: "all-items-language", value: "en", url: "http://127.0.0.1:3100" }]);
  await page.goto(base); await page.locator(".add-dialog-trigger").click();
  let dialog = page.getByRole("dialog", { name: messages.en.addItem });
  await dialog.getByLabel(messages.en.itemName, { exact: true }).fill("M3.4 blank price");
  await dialog.getByRole("button", { name: messages.en.saveItem, exact: true }).click(); await expect(page).toHaveURL(/added=/);
  await page.locator(".add-dialog-trigger").click();
  await dialog.getByLabel(messages.en.itemName, { exact: true }).fill("M3.4 currency literal");
  await dialog.getByText(messages.en.additionalDetails, { exact: true }).click();
  await dialog.locator('select[name="askingCurrency"]').selectOption("UAH");
  await dialog.locator('input[name="askingPrice"]').fill("12.34");
  await dialog.getByRole("button", { name: messages.en.close, exact: true }).first().click();
  await page.locator(".language-switcher").click(); await page.getByRole("menuitemradio", { name: "Русский" }).click();
  await page.locator(".add-dialog-trigger").click(); dialog = page.getByRole("dialog", { name: messages.ru.addItem });
  await expect(dialog.locator('select[name="askingCurrency"]')).toHaveValue("UAH");
  await expect(dialog.locator('input[name="askingPrice"]')).toHaveValue("12.34");
  await dialog.getByRole("button", { name: messages.ru.saveItem, exact: true }).click(); await expect(page).toHaveURL(/added=/);
  await page.getByRole("link", { name: "M3.4 currency literal", exact: true }).click();
  await page.getByText(messages.ru.additionalDetails, { exact: true }).click();
  await expect(page.locator('select[name="askingCurrency"]')).toHaveValue("UAH");
  await page.locator('select[name="askingCurrency"]').selectOption("JPY"); await page.locator('input[name="askingPrice"]').fill("1.5");
  await expect(page.locator('input[name="askingPrice"]')).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByRole("button", { name: messages.ru.saveChanges, exact: true })).toBeDisabled();
  await page.locator('select[name="askingCurrency"]').selectOption("KWD"); await page.locator('input[name="askingPrice"]').fill("1.234");
  await page.getByRole("button", { name: messages.ru.saveChanges, exact: true }).click(); await expect(page).toHaveURL(new RegExp(`${base}$`));
  const archive = await (await page.request.get(`${base}/api/export/archive`)).body(); expect(verifyInventoryArchive(archive).version).toBe(6);
  const records = readInventoryArchive(archive).inventory.items as Array<Record<string, unknown>>;
  expect(records.find(item=>item.name==="M3.4 blank price")).toMatchObject({asking_price_minor:null,asking_currency:null});
  expect(records.find(item=>item.name==="M3.4 currency literal")).toMatchObject({asking_price_minor:1234,asking_currency:"KWD",asking_price_exponent:3});
  await page.goto(`${base}/data`);
  await page.locator('.import-panel input[type="file"]').setInputFiles({name:"synthetic-currency.zip",mimeType:"application/zip",buffer:archive});
  await expect(page.locator(".import-summary")).toBeVisible();
  await page.getByLabel(messages.ru.importInventoryName).fill("M3.4 currency restored");
  await page.getByRole("button", { name: messages.ru.importAsNew, exact: true }).click(); await expect(page).toHaveURL(/\/inventories\/[0-9a-f-]{36}$/, {timeout:60_000});
  await page.getByRole("link", { name: "M3.4 currency literal", exact: true }).click();
  await page.getByText(messages.ru.additionalDetails, { exact: true }).click();
  await expect(page.locator('select[name="askingCurrency"]')).toHaveValue("KWD");
  await expect(page.locator('input[name="askingPrice"]')).toHaveValue("1.234");
});

test("collection covers keep a centered bounded frame and full-image viewer for awkward ratios", async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto(`${base}/collections`); await page.locator(".collection-create-trigger").click();
  const create = page.getByRole("dialog", { name: messages.ru.collectionCreate });
  await create.getByLabel(messages.ru.collectionName).fill("M3.4 bounded covers");
  await create.getByRole("button", { name: messages.ru.collectionCreate, exact: true }).click(); await expect(page).toHaveURL(/\/collections\/[0-9a-f-]+$/, {timeout:30_000});
  for (const [index, fixture] of [{name:"portrait",width:160,height:600},{name:"landscape",width:600,height:160},{name:"square",width:300,height:300},{name:"extreme",width:1600,height:80}].entries()) {
    await page.setViewportSize({ width: index < 2 ? 1365 : 360, height: 900 });
    if (index) await page.locator(".collection-cover-viewer .photo-viewer-image").click();
    await page.getByRole("button", { name: index ? messages.ru.collectionChangeCover : messages.ru.collectionAddCover, exact: true }).click();
    const dialog = page.getByRole("dialog", { name: messages.ru.collectionCover, exact: true });
    await dialog.locator('select[name="coverType"]').selectOption("upload");
    await dialog.locator('input[type="file"]').setInputFiles({name:"synthetic-cover.png",mimeType:"image/png",buffer:await sharp({create:{width:fixture.width,height:fixture.height,channels:3,background:"#7d936c"}}).png().toBuffer()});
    await dialog.getByRole("button", { name: messages.ru.collectionCoverSave, exact: true }).click();
    await expect(dialog).toHaveCount(0);
    if (index) await page.keyboard.press("Escape");
    const frame = page.locator(".collection-cover-viewer:not(.photo-viewer-open) .photo-viewer-image");
    await expect(frame.locator('[data-image-state="loaded"]')).toBeVisible();
    const geometry = await frame.evaluate(element => { const a=element.getBoundingClientRect(),img=element.querySelector("img")!,b=img.getBoundingClientRect();return {width:a.width,height:a.height,center:Math.abs((b.left+b.right-a.left-a.right)/2),fit:getComputedStyle(img).objectFit}; });
    expect(geometry.width).toBeLessThanOrEqual(560); expect(geometry.height).toBe(220); expect(geometry.center).toBeLessThan(1); expect(geometry.fit).toBe("contain");
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.screenshot({path:path.join(os.tmpdir(),`all-items-m34-cover-${fixture.name}.png`),fullPage:true});
    await frame.click(); await expect(page.getByRole("dialog",{name:messages.ru.photoViewer,exact:true})).toBeVisible();
    expect(await page.locator(".photo-viewer-open img").evaluate(img=>getComputedStyle(img).objectFit)).toBe("contain");
    await page.keyboard.press("Escape"); await expect(frame).toBeFocused();
  }
});
