import type {Locator,Page} from "@playwright/test";
export async function chooseChoice(page:Page,trigger:Locator,value:string){
  if(await trigger.evaluate(element=>element.tagName==="SELECT")){await trigger.selectOption(value);return;}
  await trigger.click();await page.locator(`.choice-options:popover-open [role="option"][data-value="${value}"]`).click();
}
