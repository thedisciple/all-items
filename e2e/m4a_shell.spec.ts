import { test, expect } from "./helpers/browser-reliability";
import { expectControlsFit, expectFooterInset, expectPageFits } from "./helpers/layout-gate";
import { messages, locales } from "../src/i18n/messages";
import sharp from "sharp";
import os from "node:os";
import path from "node:path";

const base="/inventories/00000000-0000-4000-8000-000000000001";

test("M4A shared toolbar and header fit seven widths in five languages",async({page,context})=>{
  test.setTimeout(180_000);
  for(const locale of locales){
    await context.addCookies([{name:"all-items-language",value:locale,url:"http://127.0.0.1:3100"}]);
    await page.goto(base);
    for(const width of [1440,1100,900,760,560,390,360]){
      await page.setViewportSize({width,height:900});
      await expectPageFits(page);await expectControlsFit(page.locator(".inventory-toolbar"));await expectControlsFit(page.locator(".topbar"));
      const search=await page.locator(".search-field").boundingBox();expect(search!.width).toBeGreaterThanOrEqual(230);
      const add=await page.locator(".add-dialog-trigger").boundingBox();
      if(width===1440)expect(Math.abs(add!.y-search!.y)).toBeLessThan(1);
      const toggle=page.locator(".header-sidebar-toggle");await expect(toggle).toHaveCount(1);
      if(width<=560){await expect(toggle).toBeHidden();await expect(page.locator(".side-navigation").getByRole("link").first()).toBeVisible();expect((await page.locator(".inventory-menu-trigger").boundingBox())!.width).toBeGreaterThan(100);continue;}
      const before=await toggle.boundingBox();await toggle.focus();await page.keyboard.press("Enter");
      await expect.poll(async()=>toggle.getAttribute("aria-expanded")).toBe("false");
      const after=await toggle.boundingBox();expect(after!.y).toBe(before!.y);expect(after!.height).toBe(44);
      await toggle.click();await expect(toggle).toHaveAttribute("aria-expanded","true");
      if(locale==="ru"&&width===1440)await page.screenshot({path:path.join(os.tmpdir(),`all-items-m4a-shell-${width}.png`)});
    }
    await page.locator(".add-dialog-trigger").click();
    const dialog=page.getByRole("dialog",{name:messages[locale].addItem,exact:true});
    await dialog.getByText(messages[locale].additionalDetails,{exact:true}).click();
    const labels=await dialog.locator('select[name="askingCurrency"] option').allTextContents();expect(labels.every(label=>/^[A-Z]{3}$/.test(label))).toBe(true);
    await dialog.getByRole("button",{name:messages[locale].close,exact:true}).first().click();
  }
});

test("M4A crop footer shares safe frame insets at short effective zoom sizes",async({page})=>{
  test.setTimeout(120_000);await page.goto(base);await page.locator(".add-dialog-trigger").click();
  const add=page.getByRole("dialog",{name:messages.ru.addItem,exact:true});
  await add.locator('input[name="photo"]').setInputFiles({name:"synthetic-footer.png",mimeType:"image/png",buffer:await sharp({create:{width:400,height:300,channels:3,background:"#799555"}}).png().toBuffer()});
  const crop=page.getByRole("dialog",{name:messages.ru.cropTitle,exact:true});
  // Effective CSS viewports model layout at 125/150%; physical browser zoom remains separate.
  for(const [width,height,zoom]of [[1100,720,1],[760,480,1.25],[560,420,1.5],[360,520,1]]){
    await page.setViewportSize({width:Math.round(width/zoom),height:Math.round(height/zoom)});
    await expectFooterInset(crop,15);await expectPageFits(page);
  }

});
