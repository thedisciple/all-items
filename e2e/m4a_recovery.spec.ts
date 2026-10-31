import {chromium,type BrowserContext} from "@playwright/test";
import {test,expect} from "./helpers/browser-reliability";
import {draftSnapshot,itemDraftKey} from "./helpers/draft-state";
import {messages} from "../src/i18n/messages";
import {mkdtemp,rm} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";

const base="/inventories/00000000-0000-4000-8000-000000000001";
const image=async(index:number)=>({name:`synthetic-recovery-${index}.png`,mimeType:"image/png",buffer:await sharp({create:{width:640,height:400,channels:3,background:["#65856e","#967653","#5a7596"][index%3]!}}).png().toBuffer()});

test("M4A browser restart restores all source Blobs, order, primary and pending crop geometry",async()=>{
  test.setTimeout(240_000);const profile=await mkdtemp(path.join(os.tmpdir(),"all-items-m4a-draft-profile-"));let context:BrowserContext|undefined;const errors:string[]=[];
  const launch=()=>chromium.launchPersistentContext(profile,{channel:"msedge",headless:true,locale:"ru-RU",baseURL:"http://127.0.0.1:3100",viewport:{width:390,height:820}});
  const observe=(page:import("@playwright/test").Page)=>{page.on("pageerror",error=>errors.push(error.message));page.on("console",message=>{if(message.type()==="error")errors.push(message.text());});};
  try{
    context=await launch();let page=await context.newPage();observe(page);await page.goto(base);await page.locator(".add-dialog-trigger").click();let add=page.getByRole("dialog",{name:messages.ru.addItem,exact:true});
    await add.getByLabel(messages.ru.itemName,{exact:true}).fill("M4A synthetic full restart");await add.getByLabel(messages.ru.itemModel,{exact:true}).fill("Recovered model");await add.locator('input[name="photo"]').setInputFiles(await Promise.all([0,1,2].map(image)));await expect(add.locator(".gallery-thumbnail")).toHaveCount(3);
    await add.getByRole("button",{name:messages.ru.editCrop,exact:true}).click();let crop=page.getByRole("dialog",{name:messages.ru.cropTitle,exact:true});await crop.getByRole("combobox",{name:messages.ru.cropAspect,exact:true}).selectOption("1:1");await expect(crop.getByRole("button",{name:messages.ru.cropConfirm,exact:true})).toBeEnabled();await crop.getByRole("button",{name:messages.ru.cropConfirm,exact:true}).click();
    await add.locator(".gallery-primary-button").last().click();await add.locator(".gallery-thumbnail").last().focus();await page.keyboard.press("Space");await page.keyboard.press("ArrowLeft");await expect(page.getByText(messages.ru.galleryDragPosition.replace("{number}","2").replace("{total}","3"),{exact:true})).toHaveCount(1);await page.keyboard.press("Space");
    await add.locator(".gallery-thumbnail").first().click();await add.getByRole("button",{name:messages.ru.editCrop,exact:true}).click();crop=page.getByRole("dialog",{name:messages.ru.cropTitle,exact:true});await crop.getByRole("combobox",{name:messages.ru.cropAspect,exact:true}).selectOption("16:9");
    await expect.poll(async()=>{const record=await draftSnapshot(page);return record?.photos.length===3&&record.photos.every(photo=>photo.selected&&photo.source)&&record.photos.some(photo=>photo.pending&&photo.pendingCrop&&photo.pendingCrop.width/photo.pendingCrop.height>1.7);}).toBe(true);
    const before=(await draftSnapshot(page))!;await context.close();context=await launch();page=await context.newPage();observe(page);await page.goto(base);
    expect(await draftSnapshot(page)).toEqual(before);await page.locator(".add-dialog-trigger").click();await page.getByRole("button",{name:messages.ru.draftRestore,exact:true}).click();
    add=page.getByRole("dialog",{name:messages.ru.addItem,exact:true});crop=page.getByRole("dialog",{name:messages.ru.cropTitle,exact:true});await expect(crop).toBeVisible();await expect(crop.getByRole("button",{name:messages.ru.cropConfirm,exact:true})).toBeEnabled();
    await expect(add.getByLabel(messages.ru.itemModel,{exact:true})).toHaveValue("Recovered model");
    const restored=(await draftSnapshot(page))!;expect(restored.operationId).toBe(before.operationId);expect(restored.photos.map(photo=>[photo.id,photo.selected,photo.source,photo.pending,photo.crop])).toEqual(before.photos.map(photo=>[photo.id,photo.selected,photo.source,photo.pending,photo.crop]));expect(restored.primaryId).toBe(before.primaryId);expect(restored.selectedId).toBe(before.selectedId);
    await crop.getByRole("button",{name:messages.ru.cancel,exact:true}).last().click();await add.getByRole("button",{name:messages.ru.saveItem,exact:true}).click();await expect(page).toHaveURL(/added=/,{timeout:60_000});await expect.poll(()=>draftSnapshot(page)).toBeNull();
    await page.getByRole("link",{name:"M4A synthetic full restart",exact:true}).click();await expect(page.locator(".gallery-thumbnail")).toHaveCount(3);expect(errors).toEqual([]);
  }finally{await context?.close();if(path.dirname(path.resolve(profile))!==path.resolve(os.tmpdir())||!path.basename(profile).startsWith("all-items-m4a-draft-profile-"))throw new Error("Unexpected synthetic profile path");await rm(profile,{recursive:true,force:true,maxRetries:3,retryDelay:100});}
});

test("M4A legacy draft read preserves its CAS revision and restores its photo without rewriting another tab",async({page,context})=>{
  test.setTimeout(180_000);await page.goto(base);await page.locator(".add-dialog-trigger").click();await expect(page.getByRole("dialog",{name:messages.ru.addItem,exact:true}).getByLabel(messages.ru.itemName,{exact:true})).toBeVisible();
  const source=await image(0),revision="11111111-1111-4111-8111-111111111111";
  await page.evaluate(async({key,bytes,revision})=>{
    const file=new File([new Uint8Array(bytes)],"synthetic-legacy.png",{type:"image/png",lastModified:123});const stored={data:file,name:file.name,lastModified:file.lastModified};
    const record={version:1,key,revision,updatedAt:Date.now(),fields:{name:"M4A synthetic legacy recovery",model:"Original model",brand:"",categories:[],trackingMode:"unique",originalMarking:"",description:"",notes:"",identificationStatus:"unknown",saleIntent:"not_for_sale",askingPrice:"",askingCurrency:""},rows:[{location:"",quantity:"1"}],categoryPresentation:[],photo:{selected:stored,source:stored,pending:null,crop:null}};
    await new Promise<void>((resolve,reject)=>{const open=indexedDB.open("all-items-drafts",1);open.onerror=()=>reject(open.error);open.onsuccess=()=>{const db=open.result,tx=db.transaction("drafts","readwrite");tx.objectStore("drafts").put(record);tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>{db.close();reject(tx.error);};};});
  },{key:itemDraftKey,bytes:[...source.buffer],revision});
  await page.reload();await page.locator(".add-dialog-trigger").click();await expect(page.getByRole("button",{name:messages.ru.draftRestore,exact:true})).toBeVisible();expect((await draftSnapshot(page))?.revision).toBe(revision);expect((await draftSnapshot(page))?.version).toBe(1);
  const other=await context.newPage();await other.goto(base);await other.locator(".add-dialog-trigger").click();await expect(other.getByRole("button",{name:messages.ru.draftRestore,exact:true})).toBeVisible();
  await page.getByRole("button",{name:messages.ru.draftRestore,exact:true}).click();await expect.poll(async()=>(await draftSnapshot(page))?.version).toBe(2);
  const upgraded=(await draftSnapshot(page))!;expect(upgraded.operationId).toBe(revision);expect(upgraded.photos[0]!.id).toBe(revision);expect(upgraded.photos[0]!.selected?.sha256).toBe(upgraded.photos[0]!.source?.sha256);
  await other.getByRole("button",{name:messages.ru.draftRestore,exact:true}).click();await other.getByLabel(messages.ru.itemModel,{exact:true}).fill("Stale tab change");await expect(other.getByRole("dialog",{name:messages.ru.addItem,exact:true}).getByRole("alert")).toContainText(messages.ru.draftStorageConflict);
  expect((await draftSnapshot(page))?.fields.model).toBe("Original model");await page.getByRole("dialog",{name:messages.ru.addItem,exact:true}).getByRole("button",{name:messages.ru.saveItem,exact:true}).click();await expect(page).toHaveURL(/added=/,{timeout:60_000});
});
