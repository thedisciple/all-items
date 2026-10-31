import {test,expect} from "./helpers/browser-reliability";
import type {Page} from "@playwright/test";
import sharp from "sharp";
import {messages} from "../src/i18n/messages";
import {readInventoryArchive} from "../src/export/archive";
import type {PortableInventory} from "../src/export/import";

const base="/inventories/00000000-0000-4000-8000-000000000001";
async function file(color:string){return{name:"synthetic-ack.png",mimeType:"image/png",buffer:await sharp({create:{width:400,height:300,channels:3,background:color}}).png().toBuffer()};}
async function seed(page:Page,name:string){
  await page.goto(base);await page.locator(".add-dialog-trigger").click();const dialog=page.getByRole("dialog",{name:messages.ru.addItem,exact:true});
  await dialog.getByLabel(messages.ru.itemName,{exact:true}).fill(name);await dialog.locator('input[name="photo"]').setInputFiles(await file("#658570"));
  const crop=page.getByRole("dialog",{name:messages.ru.cropTitle,exact:true});await expect(crop.getByRole("button",{name:messages.ru.cropConfirm,exact:true})).toBeEnabled();await crop.getByRole("button",{name:messages.ru.cropConfirm,exact:true}).click();
  await dialog.getByRole("button",{name:messages.ru.saveItem,exact:true}).click();await expect(page).toHaveURL(/added=/,{timeout:30_000});
  await page.getByRole("link",{name,exact:true}).click();await expect(page).toHaveURL(/\/items\/[a-f0-9-]{36}$/);
}
async function record(page:Page,name:string){const bytes=await(await page.request.get(base+"/api/export/archive")).body();return(readInventoryArchive(bytes).inventory as PortableInventory).items.find(item=>item.name===name)!;}
async function acceptCrop(page:Page){const crop=page.getByRole("dialog",{name:messages.ru.cropTitle,exact:true});await expect(crop.getByRole("button",{name:messages.ru.cropConfirm,exact:true})).toBeEnabled();await crop.getByRole("button",{name:messages.ru.cropConfirm,exact:true}).click();}

test.describe("explicit lost commit response",()=>{
  test.use({expectedResourceErrors:["Failed to load resource: net::ERR_FAILED"]});
  test("M4A gallery add and replacement retry acknowledge the same committed photo",async({page})=>{
    test.setTimeout(180_000);const name="M4A synthetic postcommit media";await seed(page,name);
    for(const mode of ["add","replace"] as const){
      let lost=false;await page.route("**/items/**",async route=>{if(!lost&&route.request().method()==="POST"&&route.request().headers()["next-action"]){lost=true;await route.fetch();await route.abort("failed");return;}await route.continue();});
      try{
        const form=mode==="add"?page.locator(".gallery-add .photo-replacement-form"):page.locator(".photo-replacement-form").first();
        await form.locator('input[name="photo"]').setInputFiles(await file(mode==="add"?"#9a7858":"#617c9a"));await acceptCrop(page);
        await expect(form.getByRole("alert")).toContainText(messages.ru.photoSaveGeneric);await expect.poll(()=>lost).toBe(true);
        const committed=await record(page,name);expect(committed.mediaAssets).toHaveLength(2);
        expect(committed.mediaAssets[mode==="add"?1:0]!.cropData).toBe(await form.locator('input[name="crop"]').inputValue());
        expect(await form.locator('input[name="photo"]').evaluate((input:HTMLInputElement)=>input.files?.length)).toBe(1);
        expect(await form.locator('input[name="photoSource"]').evaluate((input:HTMLInputElement)=>input.files?.length)).toBe(1);
        await form.getByRole("button",{name:messages.ru.retryUpload,exact:true}).click();
        await expect.poll(()=>form.locator('input[name="photo"]').evaluate((input:HTMLInputElement)=>input.files?.length)).toBe(0);
        await expect(page.locator(".gallery-thumbnail")).toHaveCount(2);
        const retried=await record(page,name);expect(retried.mediaAssets).toEqual(committed.mediaAssets);expect(retried.primaryMediaId).toBe(committed.primaryMediaId);
      }finally{await page.unroute("**/items/**");}
    }
  });

  test("M4A changed ambiguous media retry keeps its File and requires deliberate cancellation",async({page})=>{
    test.setTimeout(180_000);const name="M4A synthetic changed acknowledgement";await seed(page,name);let lost=false;
    await page.route("**/items/**",async route=>{if(!lost&&route.request().method()==="POST"&&route.request().headers()["next-action"]){lost=true;await route.fetch();await route.abort("failed");return;}await route.continue();});
    try{
      const form=page.locator(".gallery-add .photo-replacement-form");await form.locator('input[name="photo"]').setInputFiles(await file("#927765"));await acceptCrop(page);await expect(form.getByRole("alert")).toContainText(messages.ru.photoSaveGeneric);
      const committed=await record(page,name);expect(committed.mediaAssets).toHaveLength(2);
      await form.getByRole("button",{name:messages.ru.editCrop,exact:true}).click();const crop=page.getByRole("dialog",{name:messages.ru.cropTitle,exact:true});await crop.getByRole("combobox",{name:messages.ru.cropAspect,exact:true}).selectOption("1:1");await acceptCrop(page);
      await expect(form.getByRole("alert")).toContainText(messages.ru.photoWriteConflict);expect((await record(page,name)).mediaAssets).toEqual(committed.mediaAssets);
      expect(await form.locator('input[name="photo"]').evaluate((input:HTMLInputElement)=>input.files?.length)).toBe(1);await expect(form.locator('img[src^="blob:"]')).toBeVisible();
      await form.getByRole("button",{name:messages.ru.cancelSelection,exact:true}).click();await expect(page.locator(".gallery-thumbnail")).toHaveCount(2);await expect(form.getByRole("alert")).toHaveCount(0);
      await form.locator('input[name="photo"]').setInputFiles(await file("#6e7891"));await acceptCrop(page);await expect(page.locator(".gallery-thumbnail")).toHaveCount(3);
    }finally{await page.unroute("**/items/**");}
  });
});
