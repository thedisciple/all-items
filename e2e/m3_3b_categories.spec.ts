import { expect,test } from "@playwright/test";

test("category tokens use a viewport-aware overlay without shifting the form",async({page})=>{
  await page.setViewportSize({width:360,height:800});
  await page.goto("/inventories/00000000-0000-4000-8000-000000000001");
  await page.locator(".add-dialog-trigger").click();
  const dialog=page.getByRole("dialog",{name:"Добавить вещь"});
  const field=dialog.locator(".category-field-box"),trigger=dialog.locator(".category-trigger"),mode=dialog.getByLabel("Тип учёта");
  const before=(await mode.boundingBox())!.y;
  await trigger.focus();await trigger.press("ArrowDown");
  const popup=dialog.locator(".category-popover");await expect(popup).toBeVisible();
  const first=popup.locator('input[type="checkbox"]').first();await expect(first).toBeFocused();
  const bounds=(await popup.boundingBox())!;
  expect(bounds.x).toBeGreaterThanOrEqual(0);expect(bounds.x+bounds.width).toBeLessThanOrEqual(360);
  expect((await mode.boundingBox())!.y).toBe(before);
  await first.press("Space");await expect(field.locator(".category-chip")).toHaveCount(1);
  await first.press("ArrowDown");await expect(popup.locator('input[type="checkbox"]').nth(1)).toBeFocused();
  await page.keyboard.press("Escape");await expect(popup).toHaveCount(0);await expect(trigger).toBeFocused();
  await trigger.press("Backspace");await expect(field.locator(".category-chip")).toHaveCount(0);
  await trigger.click();await popup.getByLabel("Своя категория").fill("Electronics");
  await expect(popup.getByText("Это название соответствует встроенной категории; её эмодзи изменить здесь нельзя.")).toBeVisible();
  await popup.getByLabel("Эмодзи категории").fill("🧰");
  await expect(popup.getByRole("button",{name:"Добавить",exact:true})).toBeDisabled();
  await popup.getByLabel("Эмодзи категории").fill("");
  await popup.getByLabel("Своя категория").fill("My custom category");
  await popup.locator(".custom-category-row button").click();
  await expect(field.locator(".category-chip")).toContainText("My custom category");
  await dialog.getByLabel("Название").click();await expect(popup).toHaveCount(0);
});
