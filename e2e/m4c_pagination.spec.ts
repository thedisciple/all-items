import {test,expect} from "./helpers/browser-reliability";
import {createClient} from "@libsql/client";
import {pathToFileURL} from "node:url";
import path from "node:path";
import os from "node:os";
import {messages,locales} from "../src/i18n/messages";
import {expectPageFits} from "./helpers/layout-gate";

test("SQL pages, history, filtered counts, collection candidates and owned legacy links",async({page,context})=>{
  test.setTimeout(120_000);
  const root=process.env.ALL_ITEMS_E2E_ROOT!;
  expect(path.basename(root)).toMatch(/^all-items-/);expect(path.relative(os.tmpdir(),root).startsWith("..")).toBe(false);
  const db=createClient({url:pathToFileURL(path.join(root,"all-items.db")).href}),inventory=crypto.randomUUID(),collection=crypto.randomUUID();
  const base=`/inventories/${inventory}`,ids=Array.from({length:101},()=>crypto.randomUUID());
  try{
    await db.batch([{sql:"INSERT INTO workspaces(id,name,created_at) VALUES(?,'Synthetic pagination','2026-01-01')",args:[inventory]},{sql:"INSERT INTO inventory_owners(workspace_id,user_id) VALUES(?,'00000000-0000-4000-8000-000000000010')",args:[inventory]},{sql:"INSERT INTO collections(id,workspace_id,name,normalized_name,created_at,updated_at) VALUES(?,?,'Synthetic paged collection','synthetic paged collection','2026','2026')",args:[collection,inventory]},...ids.map((id,index)=>({sql:"INSERT INTO items(id,workspace_id,name,inventory_number,model,created_at,updated_at) VALUES(?,?,?,?,?,'2026','2026')",args:[id,inventory,`Synthetic page ${String(index).padStart(3,"0")}`,`INV-${index+1}`,index%2?"needle":"other"]})),...ids.slice(0,51).map(id=>({sql:"INSERT INTO item_collection_memberships(id,collection_id,item_id,created_at) VALUES(?,?,?,'2026')",args:[crypto.randomUUID(),collection,id]}))],"write");
    await context.addCookies([{name:"all-items-language",value:"en",url:"http://127.0.0.1:3100"}]);await page.setViewportSize({width:360,height:780});
    await page.goto(base+"?sort=name");await expect(page.locator(".item-grid-row")).toHaveCount(25);await expect(page.locator(".page-summary")).toContainText("101");await page.screenshot({path:path.join(os.tmpdir(),"all-items-m4c-pagination-synthetic.png")});
    await page.getByRole("link",{name:messages.en.pageNext,exact:true}).click();await expect(page).toHaveURL(/page=2/);await expect(page.getByRole("link",{name:"Synthetic page 025",exact:true})).toBeVisible();
    await page.goBack();await expect(page.getByRole("link",{name:"Synthetic page 000",exact:true})).toBeVisible();await page.goForward();
    await page.getByRole("searchbox",{name:messages.en.searchItems,exact:true}).fill("needle");await expect(page).toHaveURL(url=>url.searchParams.get("q")==="needle"&&!url.searchParams.has("page"));await expect(page.locator(".page-summary")).toContainText("50");
    await page.getByLabel(messages.en.pageSize,{exact:true}).selectOption("50");await expect(page.locator(".item-grid-row")).toHaveCount(50);await expectPageFits(page);
    await page.goto(base+"?page=99999&sort=name");await expect(page.locator(".item-grid-row")).toHaveCount(1);
    await page.getByRole("link",{name:"Synthetic page 100",exact:true}).click();await page.getByRole("button",{name:messages.en.itemDelete,exact:true}).click();const confirmation=page.getByRole("alertdialog");await confirmation.getByRole("button",{name:messages.en.itemDelete,exact:true}).click();await expect(page).toHaveURL(base);await page.goto(base+"?page=99999&sort=name");await expect(page.locator(".item-grid-row")).toHaveCount(25);
    await page.goto(`${base}/collections/${collection}?page=3`);await expect(page.locator(".item-grid-row")).toHaveCount(1);
    await page.getByRole("button",{name:messages.en.collectionAddItems,exact:true}).click();const dialog=page.getByRole("dialog",{name:messages.en.collectionAddItems,exact:true});await expect(dialog.locator(".collection-item-option")).toHaveCount(25);await dialog.getByRole("button",{name:messages.en.pageNext,exact:true}).click();await expect(dialog.locator(".collection-item-option")).toHaveCount(24);await dialog.getByRole("button",{name:messages.en.close,exact:true}).click();
    await page.goto(`/items/${ids[0]}`);await expect(page).toHaveURL(base+`/items/${ids[0]}`);
    await page.goto(`/collections/${collection}`);await expect(page).toHaveURL(base+`/collections/${collection}`);
  }finally{db.close();}
});

test.describe("expected 404 responses",()=>{
test.use({expectedResourceErrors:["Failed to load resource: the server responded with a status of 404 (Not Found)"]});
test("branded login, localized 404, attached language menu and compact Data actions",async({page,context,browser})=>{
  test.setTimeout(120_000);
  const base="/inventories/00000000-0000-4000-8000-000000000001";
  const unexpected404:string[]=[];page.on("response",response=>{if(response.status()===404&&new URL(response.url()).pathname!=="/synthetic-route-not-found")unexpected404.push(new URL(response.url()).pathname);});
  const anonymous=await browser.newContext({storageState:{cookies:[],origins:[]},viewport:{width:320,height:740}}),login=await anonymous.newPage();
  try{
  for(const locale of locales){
    await context.addCookies([{name:"all-items-language",value:locale,url:"http://127.0.0.1:3100"}]);await page.setViewportSize({width:320,height:740});
    await anonymous.addCookies([{name:"all-items-language",value:locale,url:"http://127.0.0.1:3100"}]);await login.goto("http://127.0.0.1:3100/login");await expect(login.locator(".brand-mark")).toHaveText("A");await login.getByRole("button",{name:messages[locale].language,exact:true}).click();
    const trigger=await login.locator(".language-switcher").boundingBox(),menu=await login.getByRole("menu").boundingBox();expect(menu!.x).toBeGreaterThanOrEqual(0);expect(menu!.x+menu!.width).toBeLessThanOrEqual(320);expect(menu!.x).toBeLessThan(trigger!.x+trigger!.width);expect(menu!.x+menu!.width).toBeGreaterThan(trigger!.x);expect(Math.abs(menu!.y-trigger!.y-trigger!.height)).toBeLessThan(12);await login.keyboard.press("Escape");await expect(login.locator(".language-switcher")).toBeFocused();
    await page.goto("/synthetic-route-not-found");await expect(page.getByRole("heading",{name:messages[locale].notFoundTitle})).toBeVisible();await expect(page.locator(".brand-mark")).toHaveText("A");await expect(page.locator(".app-footer")).toBeVisible();await expectPageFits(page);
    await page.goto(base+"/data");const controls=page.locator(".inventory-data-actions");await expect(controls.getByRole("button",{name:messages[locale].downloadArchive,exact:true})).toBeVisible();await expect(controls.getByText(messages[locale].exportCsvFormat,{exact:true})).toBeVisible();await expectPageFits(page);
  }
  expect(unexpected404).toEqual([]);
  }finally{await anonymous.close();}
});
});
