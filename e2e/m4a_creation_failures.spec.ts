import {test,expect} from "./helpers/browser-reliability";
import {draftSnapshot} from "./helpers/draft-state";
import {messages} from "../src/i18n/messages";
import {readInventoryArchive} from "../src/export/archive";
import type {PortableInventory} from "../src/export/import";
import type {Page} from "@playwright/test";
import sharp from "sharp";

const base="/inventories/00000000-0000-4000-8000-000000000001";
async function inventory(page:Page){return(readInventoryArchive(await(await page.request.get(base+"/api/export/archive")).body()).inventory as PortableInventory);}
async function draft(page:Page,name:string,navigate=true){
  if(navigate)await page.goto(base);await page.locator(".add-dialog-trigger").click();const add=page.getByRole("dialog",{name:messages.ru.addItem,exact:true});await add.getByLabel(messages.ru.itemName,{exact:true}).fill(name);
  await add.locator('input[name="photo"]').setInputFiles(await Promise.all([0,1,2].map(async index=>({name:`synthetic-failure-${index}.png`,mimeType:"image/png",buffer:await sharp({create:{width:320,height:240,channels:3,background:["#65836e","#967756","#5c7698"][index]!}}).png().toBuffer()}))));
  await expect(add.locator(".gallery-thumbnail")).toHaveCount(3);await expect.poll(async()=>(await draftSnapshot(page))?.photos.length).toBe(3);return add;
}
const isStage=(body:string)=>/name="_?[0-9]+_photoId"/.test(body);

test.describe("explicit interrupted creation response",()=>{
  test.use({expectedResourceErrors:["Failed to load resource: net::ERR_FAILED"]});
  test("M4A lost final acknowledgement retains the complete draft and retry recovers one item",async({page})=>{
    test.setTimeout(240_000);const name="M4A synthetic lost creation acknowledgement",add=await draft(page,name),before=(await draftSnapshot(page))!;let lost=false,finalRequests=0;
    await page.route("**/inventories/**",async route=>{const request=route.request(),body=request.postData()??"";if(request.method()==="POST"&&request.headers()["next-action"]&&body.includes("operationId")&&!isStage(body)){finalRequests++;if(!lost){lost=true;await route.fetch();await route.abort("failed");return;}}await route.continue();});
    try{
      await add.getByRole("button",{name:messages.ru.saveItem,exact:true}).click();await expect(add.getByRole("alert")).toContainText(messages.ru.creationAcknowledgementFailed);expect(lost).toBe(true);
      const saved=(await inventory(page)).items.filter(item=>item.name===name);expect(saved).toHaveLength(1);expect(saved[0]!.mediaAssets).toHaveLength(3);
      const retained=(await draftSnapshot(page))!;expect(retained.operationId).toBe(before.operationId);expect(retained.photos).toEqual(before.photos);await expect(add.locator(".gallery-thumbnail")).toHaveCount(3);
      await add.getByRole("button",{name:messages.ru.saveItem,exact:true}).click();await expect(page).toHaveURL(/added=/,{timeout:60_000});const retried=(await inventory(page)).items.filter(item=>item.name===name);expect(retried).toEqual(saved);expect(finalRequests).toBe(1);await expect.poll(()=>draftSnapshot(page)).toBeNull();
    }finally{await page.unroute("**/inventories/**");}
  });

  test("M4A changed draft after a lost acknowledgement requires an explicit new item",async({page})=>{
    test.setTimeout(240_000);const name="M4A synthetic changed acknowledged creation",add=await draft(page,name);let lost=false;
    await page.route("**/inventories/**",async route=>{const request=route.request(),body=request.postData()??"";if(!lost&&request.method()==="POST"&&request.headers()["next-action"]&&body.includes("operationId")&&!isStage(body)){lost=true;await route.fetch();await route.abort("failed");return;}await route.continue();});
    try{await add.getByRole("button",{name:messages.ru.saveItem,exact:true}).click();await expect(add.getByRole("alert")).toContainText(messages.ru.creationAcknowledgementFailed);}finally{await page.unroute("**/inventories/**");}
    expect(lost).toBe(true);const saved=(await inventory(page)).items.filter(item=>item.name===name);expect(saved).toHaveLength(1);
    await add.getByLabel(messages.ru.itemName,{exact:true}).fill(name+" corrected");await add.getByRole("button",{name:messages.ru.saveItem,exact:true}).click();await expect(add.getByRole("alert")).toContainText(messages.ru.creationAlreadySaved);await expect(add.getByRole("link",{name:messages.ru.creationOpenSaved,exact:true})).toHaveAttribute("href",base+"/items/"+saved[0]!.id);expect((await inventory(page)).items.filter(item=>item.name.startsWith(name))).toHaveLength(1);await expect(add.locator(".gallery-thumbnail")).toHaveCount(3);
    const operation=(await draftSnapshot(page))!.operationId;await add.getByRole("button",{name:messages.ru.creationUseForAnother,exact:true}).click();await expect.poll(async()=>(await draftSnapshot(page))?.operationId).not.toBe(operation);await add.getByRole("button",{name:messages.ru.saveItem,exact:true}).click();await expect(page).toHaveURL(/added=/,{timeout:60_000});const both=(await inventory(page)).items.filter(item=>item.name.startsWith(name));expect(both).toHaveLength(2);expect(new Set(both.map(item=>item.id)).size).toBe(2);expect(both.every(item=>item.mediaAssets?.length===3)).toBe(true);
  });

  test("M4A failed second upload and server validation keep all photos without a partial item",async({page})=>{
    test.setTimeout(300_000);
    for(const mode of ["abort","reject"] as const){
      const name="M4A synthetic creation "+mode,add=await draft(page,name),before=(await draftSnapshot(page))!;let count=0,injected=false;
      await page.route("**/inventories/**",async route=>{const request=route.request(),body=request.postData()??"";if(request.method()==="POST"&&request.headers()["next-action"]&&body.includes("operationId")&&isStage(body)){count++;if(!injected&&(mode==="abort"?count===2:count===1)){injected=true;if(mode==="abort"){await route.abort("failed");return;}const changed=body.replace('"trackingMode":"unique"','"trackingMode":"invalid"');expect(changed).not.toBe(body);await route.continue({postData:changed});return;}}await route.continue();});
      try{
        await add.getByRole("button",{name:messages.ru.saveItem,exact:true}).click();await expect(add.getByRole("alert")).toBeVisible();expect(injected).toBe(true);expect((await inventory(page)).items.filter(item=>item.name===name)).toHaveLength(0);
        const retained=(await draftSnapshot(page))!;expect(retained.photos).toEqual(before.photos);expect(retained.operationId).toBe(before.operationId);await expect(add.getByLabel(messages.ru.itemName,{exact:true})).toHaveValue(name);
      }finally{await page.unroute("**/inventories/**");}
      await add.getByRole("button",{name:messages.ru.saveItem,exact:true}).click();await expect(page).toHaveURL(/added=/,{timeout:60_000});const saved=(await inventory(page)).items.filter(item=>item.name===name);expect(saved).toHaveLength(1);expect(saved[0]!.mediaAssets).toHaveLength(3);
    }
  });
});

test("M4A multi-photo form can save with denied draft storage while preserving the warning",async({page})=>{
  test.setTimeout(180_000);await page.addInitScript(()=>Object.defineProperty(window,"indexedDB",{configurable:true,get(){throw new DOMException("Synthetic denied storage","SecurityError");}}));
  await page.goto(base);await page.locator(".add-dialog-trigger").click();const add=page.getByRole("dialog",{name:messages.ru.addItem,exact:true});await expect(add.getByRole("alert")).toContainText(messages.ru.draftStorageFailed);await add.getByLabel(messages.ru.itemName,{exact:true}).fill("M4A synthetic denied storage multi-photo");
  const bytes=await sharp({create:{width:200,height:150,channels:3,background:"#688573"}}).png().toBuffer();await add.locator('input[name="photo"]').setInputFiles([0,1,2].map(index=>({name:`synthetic-denied-${index}.png`,mimeType:"image/png",buffer:bytes})));await expect(add.locator(".gallery-thumbnail")).toHaveCount(3);await add.getByRole("button",{name:messages.ru.saveItem,exact:true}).click();await expect(page).toHaveURL(/added=/,{timeout:60_000});expect((await inventory(page)).items.find(item=>item.name==="M4A synthetic denied storage multi-photo")!.mediaAssets).toHaveLength(3);
});


test("M4A pending multi-photo preparation blocks closing and history exit",async({page})=>{
  test.setTimeout(180_000);await page.goto(base+"/collections");await page.locator(".side-navigation a").first().click();await expect(page).toHaveURL(new RegExp(base+"$"));const add=await draft(page,"M4A synthetic pending exit",false);let entered=false,release:()=>void=()=>{};const gate=new Promise<void>(resolve=>{release=resolve;});
  await page.route("**/inventories/**",async route=>{const request=route.request(),body=request.postData()??"";if(!entered&&request.method()==="POST"&&request.headers()["next-action"]&&isStage(body)){entered=true;await gate;}await route.continue();});
  try{await add.getByRole("button",{name:messages.ru.saveItem,exact:true}).click();await expect.poll(()=>entered).toBe(true);await expect(add.getByRole("status")).toContainText(messages.ru.creationPreparingPhotos.replace("{number}","1").replace("{total}","3"));await expect(add.getByRole("button",{name:messages.ru.close,exact:true}).last()).toBeDisabled();expect(await page.evaluate(()=>{const event=new Event("beforeunload",{cancelable:true});window.dispatchEvent(event);return event.defaultPrevented;})).toBe(true);await page.evaluate(()=>history.back());const exit=page.getByRole("alertdialog",{name:messages.ru.itemLeaveTitle,exact:true});await expect(exit.getByRole("status")).toHaveText(messages.ru.itemLeavePending);await expect(exit.getByRole("button",{name:messages.ru.itemLeaveDiscard,exact:true})).toHaveCount(0);await expect(page).toHaveURL(new RegExp(base+"$"));await exit.getByRole("button",{name:messages.ru.itemLeaveStay,exact:true}).click();release();await expect(page).toHaveURL(/added=/,{timeout:60_000});expect((await inventory(page)).items.filter(item=>item.name==="M4A synthetic pending exit")).toHaveLength(1);}finally{release();await page.unroute("**/inventories/**");}
});


test("M4A pending preparation has a native full-document unload safeguard",async({page})=>{
  test.setTimeout(180_000);await page.goto(base+"/collections");const add=await draft(page,"M4A synthetic pending native exit");let entered=false,release:()=>void=()=>{},native=0;const gate=new Promise<void>(resolve=>{release=resolve;});
  page.on("dialog",async dialog=>{expect(dialog.type()).toBe("beforeunload");native++;await dialog.dismiss();});
  await page.route("**/inventories/**",async route=>{const request=route.request(),body=request.postData()??"";if(!entered&&request.method()==="POST"&&request.headers()["next-action"]&&isStage(body)){entered=true;await gate;}if(!request.failure())await route.continue();});
  try{await add.getByRole("button",{name:messages.ru.saveItem,exact:true}).click();await expect.poll(()=>entered).toBe(true);expect(await page.evaluate(()=>{const event=new Event("beforeunload",{cancelable:true});window.dispatchEvent(event);return event.defaultPrevented;})).toBe(true);await page.evaluate(()=>history.back());await expect.poll(()=>native).toBe(1);await expect(page).toHaveURL(new RegExp(base+"$"));await expect(add.locator(".gallery-thumbnail")).toHaveCount(3);release();await expect(page).toHaveURL(/added=/,{timeout:60_000});expect((await inventory(page)).items.filter(item=>item.name==="M4A synthetic pending native exit")).toHaveLength(1);}finally{release();await page.unroute("**/inventories/**");}
});
