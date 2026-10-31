import {test,expect} from "./helpers/browser-reliability";
import type {Page} from "@playwright/test";
import sharp from "sharp";
import {messages,locales} from "../src/i18n/messages";
import {readInventoryArchive} from "../src/export/archive";
import type {PortableInventory} from "../src/export/import";
import {expectPageFits} from "./helpers/layout-gate";

const base="/inventories/00000000-0000-4000-8000-000000000001";
async function files(count:number){return Promise.all(Array.from({length:count},async(_,index)=>({name:`synthetic-${index}.png`,mimeType:"image/png",buffer:await sharp({create:{width:640,height:400,channels:3,background:["#64836e","#977456","#587397"][index%3]!}}).png().toBuffer()})));}
async function inventory(page:Page){return(readInventoryArchive(await(await page.request.get(base+"/api/export/archive")).body()).inventory as PortableInventory);}
async function open(page:Page){await page.goto(base);await page.locator(".add-dialog-trigger").click();return page.getByRole("dialog",{name:messages.ru.addItem,exact:true});}
async function accept(page:Page){const crop=page.getByRole("dialog",{name:messages.ru.cropTitle,exact:true});await expect(crop.getByRole("button",{name:messages.ru.cropConfirm,exact:true})).toBeEnabled();await crop.getByRole("button",{name:messages.ru.cropConfirm,exact:true}).click();}

test("M4A creates three individually cropped ordered photos in one save with an explicit primary",async({page})=>{
  test.setTimeout(240_000);const before=(await inventory(page)).items.length,dialog=await open(page);
  await dialog.locator('input[name="photo"]').setInputFiles(await files(3));await expect(dialog.locator(".gallery-thumbnail")).toHaveCount(3);
  for(const [index,aspect]of ["1:1","4:3","16:9"].entries()){
    await dialog.locator(".gallery-thumbnail").nth(index).click();await dialog.getByRole("button",{name:messages.ru.editCrop,exact:true}).click();
    const crop=page.getByRole("dialog",{name:messages.ru.cropTitle,exact:true});await expect(crop.getByRole("button",{name:messages.ru.cropConfirm,exact:true})).toBeEnabled();await crop.getByRole("combobox",{name:messages.ru.cropAspect,exact:true}).selectOption(aspect);await accept(page);
  }
  await dialog.locator(".gallery-primary-button").nth(1).click();
  const original=await dialog.locator(".gallery-thumb-wrap").evaluateAll(nodes=>nodes.map(node=>(node as HTMLElement).dataset.photoId));
  await dialog.locator(".gallery-thumbnail").last().focus();await page.keyboard.press("Space");await expect(dialog.locator(".gallery-rail-region")).toHaveAttribute("data-sorting","true");
  for(const position of [2,1]){await page.keyboard.press("ArrowLeft");await expect(page.getByText(messages.ru.galleryDragPosition.replace("{number}",String(position)).replace("{total}","3"),{exact:true})).toHaveCount(1);}
  await page.keyboard.press("Space");await expect.poll(()=>dialog.locator(".gallery-thumb-wrap").evaluateAll(nodes=>nodes.map(node=>(node as HTMLElement).dataset.photoId))).toEqual([original[2],original[0],original[1]]);
  expect((await inventory(page)).items).toHaveLength(before);
  await dialog.getByLabel(messages.ru.itemName,{exact:true}).fill("M4A synthetic multi-create");
  await dialog.getByRole("button",{name:messages.ru.saveItem,exact:true}).click();await expect(page).toHaveURL(/added=/,{timeout:60_000});
  const result=await inventory(page);expect(result.items).toHaveLength(before+1);const item=result.items.find(item=>item.name==="M4A synthetic multi-create")!;
  expect(item.mediaAssets).toHaveLength(3);expect(item.mediaAssets.map(photo=>photo.originalFilename)).toEqual(["crop-synthetic-2.webp","crop-synthetic-0.webp","crop-synthetic-1.webp"]);
  expect(item.mediaAssets.map(photo=>photo.isPrimary)).toEqual([false,false,true]);expect(item.primaryMediaId).toBe(item.mediaAssets[2]!.id);
  expect(new Set(item.mediaAssets.map(photo=>photo.cropData)).size).toBe(3);
  await page.getByRole("link",{name:item.name,exact:true}).click();await expect(page.locator(".gallery-thumbnail")).toHaveCount(3);
});

test("M4A ten-photo intake rejects excess without losing the draft and supports confirmed remove/re-add",async({page})=>{
  test.setTimeout(240_000);const before=(await inventory(page)).items.length,dialog=await open(page),images=await files(11);
  await dialog.getByLabel(messages.ru.itemName,{exact:true}).fill("M4A synthetic ten-photo creation");
  await dialog.locator('input[name="photo"]').setInputFiles(images);await expect(dialog.getByRole("alert")).toContainText(messages.ru.creationSlotsExceeded.replace("{count}","10"));await expect(dialog.locator(".gallery-thumbnail")).toHaveCount(0);
  await dialog.locator('input[name="photo"]').setInputFiles(images.slice(0,10));await expect(dialog.locator(".gallery-thumbnail")).toHaveCount(10);await expect(dialog.locator('input[name="photo"]')).toHaveCount(0);
  await page.setViewportSize({width:360,height:820});await expectPageFits(page);
  await dialog.getByRole("button",{name:messages.ru.photoDelete,exact:true}).click();await page.getByRole("alertdialog").getByRole("button",{name:messages.ru.photoDelete,exact:true}).click();await expect(dialog.locator(".gallery-thumbnail")).toHaveCount(9);
  expect((await inventory(page)).items).toHaveLength(before);
  const retained=await dialog.locator(".gallery-thumb-wrap").evaluateAll(nodes=>nodes.map(node=>(node as HTMLElement).dataset.photoId));
  await dialog.locator('input[name="photo"]').setInputFiles(images.slice(0,2));await expect(dialog.getByRole("alert")).toContainText(messages.ru.creationSlotsExceeded.replace("{count}","1"));
  expect(await dialog.locator(".gallery-thumb-wrap").evaluateAll(nodes=>nodes.map(node=>(node as HTMLElement).dataset.photoId))).toEqual(retained);
  await dialog.locator('input[name="photo"]').setInputFiles(images[10]!);await accept(page);await expect(dialog.locator(".gallery-thumbnail")).toHaveCount(10);
  const rail=dialog.locator(".gallery-strip");await rail.scrollIntoViewIfNeeded();await rail.evaluate(node=>{node.scrollLeft=node.scrollWidth;});
  const last=dialog.locator(".gallery-thumbnail").last();await last.hover();const box=(await last.boundingBox())!,frame=(await rail.boundingBox())!;
  await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.waitForTimeout(260);await expect(dialog.locator(".gallery-rail-region")).toHaveAttribute("data-sorting","true");
  await page.mouse.move(frame.x+5,box.y+box.height/2,{steps:15});await expect.poll(()=>rail.evaluate(node=>node.scrollLeft),{timeout:10_000}).toBeLessThan(2);await page.mouse.move(frame.x+30,box.y+box.height/2);await page.mouse.up();
  await expect(dialog.getByLabel(messages.ru.itemName,{exact:true})).toHaveValue("M4A synthetic ten-photo creation");
  await dialog.getByRole("button",{name:messages.ru.saveItem,exact:true}).click();await expect(page).toHaveURL(/added=/,{timeout:60_000});
  const result=await inventory(page);expect(result.items).toHaveLength(before+1);const item=result.items.find(item=>item.name==="M4A synthetic ten-photo creation")!;expect(item.mediaAssets).toHaveLength(10);expect(item.mediaAssets[0]!.originalFilename).toBe("crop-synthetic-10.webp");
});

test("M4A unsaved touch hold reorders locally while a short touch only browses",async({page,context})=>{
  test.setTimeout(180_000);const before=(await inventory(page)).items.length,dialog=await open(page);await page.setViewportSize({width:390,height:820});
  await dialog.locator('input[name="photo"]').setInputFiles(await files(3));await expect(dialog.locator(".gallery-thumbnail")).toHaveCount(3);
  const ids=await dialog.locator(".gallery-thumb-wrap").evaluateAll(nodes=>nodes.map(node=>(node as HTMLElement).dataset.photoId));
  const cdp=await context.newCDPSession(page);await cdp.send("Emulation.setTouchEmulationEnabled",{enabled:true,maxTouchPoints:1});
  const touch=async(type:"touchStart"|"touchMove"|"touchEnd",x?:number,y?:number)=>cdp.send("Input.dispatchTouchEvent",{type,touchPoints:x===undefined||y===undefined?[]:[{x,y,id:1}]});
  await dialog.locator(".gallery-thumbnail").first().scrollIntoViewIfNeeded();const first=(await dialog.locator(".gallery-thumbnail").first().boundingBox())!,last=(await dialog.locator(".gallery-thumbnail").last().boundingBox())!;
  await touch("touchStart",first.x+first.width/2,first.y+first.height/2);await page.waitForTimeout(150);await expect(dialog.locator(".gallery-rail-region")).toHaveAttribute("data-sorting","false");await touch("touchEnd");
  expect(await dialog.locator(".gallery-thumb-wrap").evaluateAll(nodes=>nodes.map(node=>(node as HTMLElement).dataset.photoId))).toEqual(ids);
  await touch("touchStart",first.x+first.width/2,first.y+first.height/2);await page.waitForTimeout(420);await expect(dialog.locator(".gallery-rail-region")).toHaveAttribute("data-sorting","true");
  for(let step=1;step<=10;step++)await touch("touchMove",first.x+first.width/2+(last.x-first.x)*step/10,first.y+first.height/2);await touch("touchEnd");
  await expect.poll(()=>dialog.locator(".gallery-thumb-wrap").evaluateAll(nodes=>nodes.map(node=>(node as HTMLElement).dataset.photoId))).toEqual([ids[1],ids[2],ids[0]]);
  expect((await inventory(page)).items).toHaveLength(before);await expect(dialog.locator(`.gallery-thumb-wrap[data-photo-id="${ids[0]}"] .gallery-primary-button`)).toHaveAttribute("aria-pressed","true");
  await cdp.detach();
});


test("M4A multi-photo controls fit at 360px in all five locales and support keyboard cancellation",async({page,context})=>{
  test.setTimeout(240_000);await page.setViewportSize({width:360,height:740});await page.emulateMedia({reducedMotion:"reduce"});
  for(const locale of locales){
    await context.addCookies([{name:"all-items-language",value:locale,url:"http://127.0.0.1:3100"}]);await page.goto(base);await page.locator(".add-dialog-trigger").click();const dialog=page.getByRole("dialog",{name:messages[locale].addItem,exact:true});await dialog.locator('input[name="photo"]').setInputFiles(await files(3));await expect(dialog.locator(".gallery-thumbnail")).toHaveCount(3);await expectPageFits(page);
    const stars=dialog.locator(".gallery-primary-button");expect(await stars.count()).toBe(3);await stars.nth(2).focus();await page.keyboard.press("Enter");await expect(stars.nth(2)).toHaveAttribute("aria-pressed","true");expect(await dialog.locator('.gallery-primary-button[aria-pressed="true"]').count()).toBe(1);
    const order=await dialog.locator(".gallery-thumb-wrap").evaluateAll(nodes=>nodes.map(node=>(node as HTMLElement).dataset.photoId));await dialog.locator(".gallery-thumbnail").last().focus();await page.keyboard.press("Space");await expect(dialog.locator(".gallery-rail-region")).toHaveAttribute("data-sorting","true");await page.keyboard.press("ArrowLeft");await page.keyboard.press("Escape");await expect(dialog.locator(".gallery-rail-region")).toHaveAttribute("data-sorting","false");expect(await dialog.locator(".gallery-thumb-wrap").evaluateAll(nodes=>nodes.map(node=>(node as HTMLElement).dataset.photoId))).toEqual(order);
    await dialog.getByRole("button",{name:messages[locale].photoDelete,exact:true}).click();const confirmation=page.getByRole("alertdialog");await expect(confirmation).toBeVisible();await page.keyboard.press("Escape");await expect(confirmation).toHaveCount(0);await expect(dialog.locator(".gallery-thumbnail")).toHaveCount(3);
    await dialog.getByRole("button",{name:messages[locale].discardDraft,exact:true}).click();await page.getByRole("alertdialog").getByRole("button",{name:messages[locale].discardDraft,exact:true}).click();await expect(dialog.locator(".gallery-thumbnail")).toHaveCount(0);await dialog.getByRole("button",{name:messages[locale].close,exact:true}).first().click();
  }
});
