import {chromium,type FullConfig} from "@playwright/test";
import {syntheticAccounts} from "./auth-credentials";
export default async function setup(config:FullConfig){
  const browser=await chromium.launch({channel:"msedge"});try{const page=await browser.newPage({locale:"en-US"});await page.goto("http://127.0.0.1:3100/login");await page.locator('input[name="username"]').fill(syntheticAccounts.owner.username);await page.locator('input[name="password"]').fill(syntheticAccounts.owner.password);await page.locator('button[type="submit"]').click();await page.waitForURL(/\/inventories\//);await page.context().storageState({path:config.projects[0]!.use.storageState as string});}finally{await browser.close();}
}
