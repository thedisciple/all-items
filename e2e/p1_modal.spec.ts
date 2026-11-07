import {test,expect} from "./helpers/browser-reliability";
import {expectPageFits} from "./helpers/layout-gate";
import {locales,messages} from "../src/i18n/messages";
import os from "node:os";
import path from "node:path";

for(const locale of locales)test(`Add Item confines scrolling and retains fields: ${locale}`,async({page,context})=>{
  test.setTimeout(180_000);
    await context.addCookies([{name:"all-items-language",value:locale,url:"http://127.0.0.1:3100"}]);
    await page.goto("/");await page.locator(".add-dialog-trigger").click();
    const dialog=page.getByRole("dialog",{name:messages[locale].addItem,exact:true});
    await dialog.getByLabel(messages[locale].itemName,{exact:true}).fill("Synthetic P1 retained draft");
    await dialog.getByText(messages[locale].additionalDetails,{exact:true}).click();
    for(const [width,height] of [[1365,900],[760,600],[390,700],[360,640],[608,400],[507,333]]){
      // The last two effective viewports model 125/150% layout; physical zoom is separate.
      await page.setViewportSize({width,height});await expectPageFits(page);
      const body=dialog.locator(".add-dialog-body"),heading=dialog.locator(":scope > .dialog-heading"),footer=dialog.locator(".add-dialog-footer");
      const before=await Promise.all([heading.boundingBox(),footer.boundingBox()]);
      await body.evaluate(element=>{element.scrollTop=element.scrollHeight;});
      const after=await Promise.all([heading.boundingBox(),footer.boundingBox()]);expect(after).toEqual(before);
      const geometry=await dialog.evaluate(element=>{
        const body=element.querySelector<HTMLElement>(".add-dialog-body")!,footer=element.querySelector<HTMLElement>(".add-dialog-footer")!,heading=element.querySelector<HTMLElement>(".dialog-heading")!;
        const b=body.getBoundingClientRect(),f=footer.getBoundingClientRect(),h=heading.getBoundingClientRect();
        const bodyStyle=getComputedStyle(body),footerStyle=getComputedStyle(footer),formStyle=getComputedStyle(body.parentElement!);
        return {bodyTop:b.top,bodyBottom:b.bottom,headerBottom:h.bottom,footerTop:f.top,footerBottom:f.bottom,height:innerHeight,outerOverflow:element.scrollHeight-element.clientHeight,formOverflow:body.parentElement!.scrollHeight-body.parentElement!.clientHeight,formBottomPadding:parseFloat(formStyle.paddingBottom),bodyBottomPadding:parseFloat(bodyStyle.paddingBottom),dialogBackground:getComputedStyle(element).backgroundColor,footerBackground:footerStyle.backgroundColor};
      });
      expect(geometry.bodyTop).toBeGreaterThanOrEqual(geometry.headerBottom-1);expect(Math.abs(geometry.bodyBottom-geometry.footerTop)).toBeLessThanOrEqual(1);expect(geometry.footerBottom).toBeLessThanOrEqual(geometry.height);expect(geometry.outerOverflow).toBeLessThanOrEqual(1);expect(geometry.formOverflow).toBeLessThanOrEqual(1);expect(geometry.formBottomPadding).toBe(0);expect(geometry.bodyBottomPadding).toBeGreaterThanOrEqual(12);expect(geometry.bodyBottomPadding).toBeLessThanOrEqual(20);expect(geometry.footerBackground).toBe(geometry.dialogBackground);
      await dialog.getByLabel(messages[locale].itemNotes,{exact:true}).scrollIntoViewIfNeeded();
      const last=await dialog.getByLabel(messages[locale].itemNotes,{exact:true}).boundingBox();expect(last!.y+last!.height).toBeLessThanOrEqual(geometry.footerTop+1);
      const photo=dialog.getByRole("button",{name:messages[locale].addPhoto,exact:true});await photo.scrollIntoViewIfNeeded();const photoBox=await photo.boundingBox();expect(photoBox!.y).toBeGreaterThanOrEqual(geometry.headerBottom);expect(photoBox!.y+photoBox!.height).toBeLessThanOrEqual(geometry.footerTop);
      await footer.getByRole("button",{name:messages[locale].saveItem,exact:true}).focus();await expect(footer.getByRole("button",{name:messages[locale].saveItem,exact:true})).toBeFocused();
    }
    if(locale==="ru")await page.screenshot({path:path.join(os.tmpdir(),"all-items-p1-modal-synthetic.png")});
    await dialog.locator(".add-dialog-footer").getByRole("button",{name:messages[locale].close,exact:true}).click();
    await page.locator(".add-dialog-trigger").click();await expect(dialog.getByLabel(messages[locale].itemName,{exact:true})).toHaveValue("Synthetic P1 retained draft");
    await dialog.locator(".dialog-heading button").click();
});
