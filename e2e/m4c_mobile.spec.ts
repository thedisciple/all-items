import {test,expect} from "./helpers/browser-reliability";
import {locales,messages} from "../src/i18n/messages";
import os from "node:os";
import path from "node:path";
import {expectPageFits} from "./helpers/layout-gate";
import sharp from "sharp";
import {chooseChoice} from "./helpers/choice-picker";

const base="/inventories/00000000-0000-4000-8000-000000000001";
test("mobile shell keeps full brand, direct tabs and equal controls",async({page,context})=>{
  test.setTimeout(120_000);
  for(const locale of locales){
    await context.addCookies([{name:"all-items-language",value:locale,url:"http://127.0.0.1:3100"}]);await page.goto(base);
    for(const width of[320,360,375,390,412,430,768,1440]){
      await page.setViewportSize({width,height:820});await expectPageFits(page);
      const nav=page.locator(".side-navigation");await expect(nav.getByRole("link")).toHaveCount(2);
      if(width<=768){
        await expect(page.locator(".brand-text")).toHaveText("All Items");
        const geometry=await page.locator(".sidebar").evaluate(root=>{
          const brand=root.querySelector<HTMLElement>(".brand")!.getBoundingClientRect(),nav=root.querySelector<HTMLElement>("nav")!.getBoundingClientRect();
          const text=root.querySelector<HTMLElement>(".brand-text")!;
          return{brandRight:brand.right,navLeft:nav.left,navRight:nav.right,brandTop:brand.top,navTop:nav.top,textWidth:text.clientWidth,textScroll:text.scrollWidth};
        });
        expect(geometry.brandRight).toBeLessThanOrEqual(geometry.navLeft+1);expect(geometry.navRight).toBeLessThanOrEqual(width);
        expect(Math.abs(geometry.brandTop-geometry.navTop)).toBeLessThan(12);expect(geometry.textScroll).toBeLessThanOrEqual(geometry.textWidth+1);
        const heights=await page.locator(".inventory-menu-trigger,.inventory-settings-link,.account-menu > summary").evaluateAll(elements=>elements.map(element=>element.getBoundingClientRect().height));
        expect(heights).toEqual([44,44,44]);
      }
      if(locale==="ru"&&[320,390,768].includes(width))await page.screenshot({path:path.join(os.tmpdir(),`all-items-m4c-shell-${width}-synthetic.png`)});
    }
  }
  await context.addCookies([{name:"all-items-language",value:"en",url:"http://127.0.0.1:3100"}]);await page.goto(base);await page.setViewportSize({width:1440,height:900});
  await page.locator(".header-sidebar-toggle").click();await expect(page.locator(".sidebar")).toHaveAttribute("data-collapsed","true");
  await page.setViewportSize({width:320,height:780});await expect(page.locator(".sidebar .brand-text")).toBeVisible();await expectPageFits(page);
  await page.getByRole("link",{name:messages.en.inventoryManage,exact:true}).click();await page.getByRole("link",{name:messages.en.data,exact:true}).click();
  await expect(page.getByRole("heading",{name:messages.en.data,exact:true})).toBeVisible();
});

test("mobile native intake and crop viewport fit portrait, wide and short screens",async({browser,context})=>{
  test.setTimeout(120_000);
  const mobile=await browser.newContext({storageState:await context.storageState(),isMobile:true,hasTouch:true,viewport:{width:360,height:640},locale:"ru-RU"});
  try{
    const page=await mobile.newPage();await page.goto("http://127.0.0.1:3100"+base);await page.locator(".add-dialog-trigger").click();
    const add=page.getByRole("dialog",{name:messages.ru.addItem,exact:true});
    for(const [index,width,height] of [[0,240,800],[1,800,240],[2,1600,100]]){
      const chooser=page.waitForEvent("filechooser");await add.getByRole("button",{name:messages.ru.addPhoto,exact:true}).click();
      const filePicker=await chooser;await expect(page.locator(".photo-source-dialog:not(.add-item-dialog):not(.crop-dialog)")).toHaveCount(0);
      await filePicker.setFiles({name:`synthetic-${index}.png`,mimeType:"image/png",buffer:await sharp({create:{width:width!,height:height!,channels:3,background:"#64745b"}}).png().toBuffer()});
      const crop=page.getByRole("dialog",{name:messages.ru.cropTitle,exact:true});await expect(crop.getByRole("button",{name:messages.ru.cropConfirm,exact:true})).toBeEnabled();
      for(const viewport of[{width:320,height:480},{width:390,height:760},{width:768,height:430}]){
        await page.setViewportSize(viewport);
        await expect.poll(async()=>crop.locator(".crop-viewport").evaluate(element=>Math.abs(element.clientWidth-28-(element.querySelector(".cropper-container")?.getBoundingClientRect().width??0)))).toBeLessThanOrEqual(2);
        const bounds=await crop.evaluate(element=>{const body=element.querySelector<HTMLElement>(".crop-editor-body")!,viewport=element.querySelector<HTMLElement>(".crop-viewport")!,canvas=element.querySelector<HTMLElement>(".cropper-container")!;const a=viewport.getBoundingClientRect(),b=canvas.getBoundingClientRect(),footer=element.querySelector<HTMLElement>(".crop-actions")!.getBoundingClientRect();return{dialogOverflow:element.scrollWidth-element.clientWidth,bodyOverflow:body.scrollWidth-body.clientWidth,center:Math.abs((a.left+a.right)-(b.left+b.right)),footerBottom:footer.bottom,screen:innerHeight};});
        const overflow=await crop.locator(".crop-editor-body").evaluate(root=>{const box=root.getBoundingClientRect();return Array.from(root.querySelectorAll<HTMLElement>("*")).filter(element=>element.getBoundingClientRect().right>box.right+1).map(element=>({tag:element.tagName,cls:element.className,width:element.getBoundingClientRect().width,right:element.getBoundingClientRect().right,box:box.right})).slice(0,15);});
        expect(bounds.dialogOverflow).toBeLessThanOrEqual(1);expect(bounds.bodyOverflow,JSON.stringify({viewport,bounds,overflow})).toBeLessThanOrEqual(1);expect(bounds.center).toBeLessThanOrEqual(2);expect(bounds.footerBottom).toBeLessThanOrEqual(bounds.screen);
        await expectPageFits(page);
      }
      await page.setViewportSize({width:360,height:640});
      await crop.getByRole("combobox",{name:messages.ru.cropAspect,exact:true}).click();
      const option=page.getByRole("option",{name:"1:1",exact:true});await expect(option).toBeVisible();await option.click();
      await crop.getByRole("button",{name:messages.ru.cropRotate,exact:true}).click();
      await chooseChoice(page,crop.getByRole("combobox",{name:messages.ru.cropAspect,exact:true}),"original");
      if(index===0)await page.screenshot({path:path.join(os.tmpdir(),"all-items-m4c-crop-synthetic.png")});
      await crop.getByRole("button",{name:messages.ru.cropConfirm,exact:true}).click();
      await expect(crop).toHaveCount(0);
    }
    await expect(add.locator(".gallery-thumb-wrap")).toHaveCount(3);
    await add.getByText(messages.ru.additionalDetails,{exact:true}).click();
    const currency=add.getByRole("combobox",{name:messages.ru.currency,exact:true});await currency.focus();await page.keyboard.press("ArrowDown");await page.keyboard.press("j");await page.keyboard.press("p");await page.keyboard.press("y");await page.keyboard.press("Enter");await expect(add.locator('[name="askingCurrency"]')).toHaveValue("JPY");await expect(currency).toBeFocused();
    await currency.click();await page.keyboard.press("Escape");await expect(currency).toBeFocused();await currency.click();await add.getByRole("heading",{name:messages.ru.addItem,exact:true}).click();await expect(page.locator(".choice-options:popover-open")).toHaveCount(0);
  }finally{await mobile.close();}
});
