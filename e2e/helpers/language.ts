import {expect,type Page} from "@playwright/test";

export async function chooseAccountLanguage(page:Page,native:string){
  const returnTo=page.url();
  const locale:Record<string,string>={"Русский":"ru",English:"en","Українська":"uk",Srpski:"sr-Latn","简体中文":"zh-Hans"};
  await page.goto("/account");
  await page.locator(".account-settings .language-switcher").click();
  await page.getByRole("menuitemradio",{name:native,exact:true}).click();
  await expect(page.locator("html")).toHaveAttribute("lang",locale[native]!);
  await page.goto(returnTo);
}
