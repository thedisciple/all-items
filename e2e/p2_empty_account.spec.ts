import {test,expect} from "@playwright/test";
import os from "node:os";
import path from "node:path";
import {locales,messages} from "../src/i18n/messages";
import {syntheticAccounts} from "./helpers/auth-credentials";
import {expectPageFits} from "./helpers/layout-gate";

test.use({storageState:{cookies:[],origins:[]}});

for(const locale of locales)test(`new account uses the app shell: ${locale}`,async({page,context})=>{
  test.setTimeout(90_000);
  await context.addCookies([{name:"all-items-language",value:locale,url:"http://127.0.0.1:3100"}]);
  await page.goto("/login");
  await page.locator('input[name="username"]').fill(syntheticAccounts.alice.username);
  await page.locator('input[name="password"]').fill(syntheticAccounts.alice.password);
  await page.locator('button[type="submit"]').click();
  await expect(page).toHaveURL("http://127.0.0.1:3100/");
  const shell=page.locator(".empty-account-shell");
  await expect(shell.locator(".brand-mark")).toHaveText("A");
  await expect(shell.locator(".sidebar .brand")).toHaveAttribute("href","/");
  await expect(shell.getByRole("heading",{name:messages[locale].inventoryEmptyInstallation,exact:true})).toBeVisible();
  await expect(shell.locator('.side-navigation [aria-disabled="true"]')).toHaveCount(3);
  await expect(shell.locator(".side-navigation a")).toHaveCount(0);
  await expect(shell.locator(".inventory-create-button")).toHaveCount(1);
  for(const [width,height] of [[1365,900],[390,700],[360,640]]){
    await page.setViewportSize({width,height});
    await expectPageFits(page);
    const geometry=await shell.evaluate(element=>{
      const brand=element.querySelector<HTMLElement>(".brand")!.getBoundingClientRect();
      const heading=element.querySelector<HTMLElement>("h1")!.getBoundingClientRect();
      const action=element.querySelector<HTMLElement>(".inventory-create-button")!.getBoundingClientRect();
      return {brandRight:brand.right,headingTop:heading.top,headingBottom:heading.bottom,actionTop:action.top,actionRight:action.right,viewport:innerWidth};
    });
    expect(geometry.headingTop).toBeGreaterThan(0);
    expect(geometry.actionTop-geometry.headingBottom).toBeGreaterThanOrEqual(18);
    expect(geometry.actionRight).toBeLessThanOrEqual(geometry.viewport);
    expect(geometry.brandRight).toBeLessThanOrEqual(geometry.viewport);
  }
  if(locale==="ru")await page.screenshot({path:path.join(os.tmpdir(),"all-items-p2-empty-account-synthetic.png")});
  await shell.getByLabel(messages[locale].authAccount,{exact:true}).click();
  await expect(shell.getByRole("button",{name:messages[locale].authSignOut,exact:true})).toBeVisible();
  await shell.getByRole("button",{name:messages[locale].language,exact:true}).click();
  await expect(shell.getByRole("menu",{name:messages[locale].language,exact:true})).toBeVisible();
  await page.keyboard.press("Escape");
  await shell.locator(".inventory-create-button").focus();
  await expect(shell.locator(".inventory-create-button")).toBeFocused();
  await shell.locator(".inventory-create-button").click();
  const dialog=page.getByRole("dialog",{name:messages[locale].inventoryCreate,exact:true});
  await expect(dialog.locator('input[name="name"]')).toBeFocused();
  await dialog.getByRole("button",{name:messages[locale].cancel,exact:true}).click();
});
