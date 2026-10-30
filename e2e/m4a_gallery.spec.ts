import {test,expect} from "./helpers/browser-reliability";
import type {Page} from "@playwright/test";
import sharp from "sharp";
import {messages} from "../src/i18n/messages";
import {readInventoryArchive} from "../src/export/archive";
import type {PortableInventory} from "../src/export/import";
import {galleryFixture} from "./helpers/gallery-fixture";
import {expectPageFits} from "./helpers/layout-gate";

const base="/inventories/00000000-0000-4000-8000-000000000001";
const name="M4A synthetic gallery seed";

test("M4A exit history fallback protects edits when Navigation API is unavailable",async({page})=>{
  test.setTimeout(90_000);
  await page.addInitScript(()=>Object.defineProperty(window,"navigation",{value:undefined,configurable:true}));
  await page.goto(base);await page.locator(".add-dialog-trigger").click();
  const add=page.getByRole("dialog",{name:messages.ru.addItem,exact:true});
  await add.getByLabel(messages.ru.itemName,{exact:true}).fill("M4A synthetic fallback exit");
  await add.getByRole("button",{name:messages.ru.saveItem,exact:true}).click();await expect(page).toHaveURL(/added=/,{timeout:30_000});
  const inventoryUrl=page.url();await page.getByRole("link",{name:"M4A synthetic fallback exit",exact:true}).click();await expect(page).toHaveURL(/\/items\/[a-f0-9-]{36}$/);
  const itemUrl=page.url();await page.getByLabel(messages.ru.itemModel,{exact:true}).fill("Retained fallback edit");
  await page.evaluate(()=>history.back());await expect(page.getByRole("alertdialog")).toBeVisible();await expect(page).toHaveURL(itemUrl);
  await page.getByRole("alertdialog").getByRole("button",{name:messages.ru.itemLeaveStay,exact:true}).click();
  await expect(page.getByLabel(messages.ru.itemModel,{exact:true})).toHaveValue("Retained fallback edit");
  await page.evaluate(()=>history.back());await page.getByRole("alertdialog").getByRole("button",{name:messages.ru.itemLeaveDiscard,exact:true}).click();await expect(page).toHaveURL(inventoryUrl);
});
async function seed(page:Page,label=name){
  await page.goto(base);await page.locator(".add-dialog-trigger").click();const add=page.getByRole("dialog",{name:messages.ru.addItem,exact:true});
  await add.getByLabel(messages.ru.itemName,{exact:true}).fill(label);
  await add.locator('input[name="photo"]').setInputFiles({name:"synthetic-seed.png",mimeType:"image/png",buffer:await sharp({create:{width:400,height:300,channels:3,background:"#5d8568"}}).png().toBuffer()});
  const crop=page.getByRole("dialog",{name:messages.ru.cropTitle,exact:true});await expect(crop.getByRole("button",{name:messages.ru.cropConfirm,exact:true})).toBeEnabled();await crop.getByRole("button",{name:messages.ru.cropConfirm,exact:true}).click();
  await add.getByRole("button",{name:messages.ru.saveItem,exact:true}).click();await expect(page).toHaveURL(/added=/,{timeout:30_000});
  return(await page.request.get(base+"/api/export/archive")).body();
}
async function importFixture(page:Page,bytes:Uint8Array,count:number,label=name){
  await page.goto(base+"/data");await page.locator('.import-panel input[type="file"]').setInputFiles({name:"synthetic-gallery.zip",mimeType:"application/zip",buffer:Buffer.from(bytes)});
  await expect(page.locator(".import-summary")).toBeVisible();await page.getByLabel(messages.ru.importInventoryName).fill("M4A synthetic "+count+" "+Date.now());
  await page.getByRole("button",{name:messages.ru.importAsNew,exact:true}).click();await expect(page).toHaveURL(/\/inventories\/[a-f0-9-]{36}$/, {timeout:60_000});
  const target=new URL(page.url()).pathname;await page.getByRole("link",{name:label,exact:true}).click();await expect(page).toHaveURL(/\/items\/[a-f0-9-]{36}$/, {timeout:30_000});await expect(page.locator(".photo-gallery")).toBeVisible();return target;
}
async function order(page:Page,target:string){const bytes=await(await page.request.get(target+"/api/export/archive")).body();const item=(readInventoryArchive(bytes).inventory as PortableInventory).items[0]!;return{ids:item.mediaAssets.map(photo=>photo.id),primary:item.primaryMediaId};}

test("M4A browsing, primary, hold sorting, cancellation and long rails keep separate state",async({page})=>{
  test.setTimeout(300_000);const source=await seed(page);
  for(const count of [1,2,3,10,12]){
    const target=await importFixture(page,galleryFixture(source,name,count),count);await page.setViewportSize({width:390,height:820});
    await expect(page.locator(".gallery-thumbnail")).toHaveCount(count,{timeout:15_000});await expect(page.locator('.gallery-primary-button[aria-pressed="true"]')).toHaveCount(1);
    await expect(page.locator("button button")).toHaveCount(0);await expectPageFits(page);
    const before=await order(page,target);
    await page.locator(".gallery-thumbnail").first().click();await expect(page.locator(".gallery-thumbnail").first()).toHaveAttribute("aria-current","true");
    expect(await order(page,target)).toEqual(before);
    if(count===1)continue;
    await page.getByRole("button",{name:messages.ru.galleryNext,exact:true}).click();expect(await order(page,target)).toEqual(before);
    await page.locator(".photo-viewer-image").click();await expect(page.getByRole("dialog",{name:messages.ru.photoViewer,exact:true})).toBeVisible();await page.keyboard.press("ArrowLeft");await expect(page.locator(".gallery-counter")).toHaveText("1 / "+count);await page.keyboard.press("Escape");
    await page.locator(".gallery-thumbnail").first().focus();await page.keyboard.press("Space");await page.keyboard.press("ArrowRight");await page.keyboard.press("Escape");expect(await order(page,target)).toEqual(before);
    const rail=page.locator(".gallery-strip");
    if(count>=10){
      await rail.scrollIntoViewIfNeeded();await rail.evaluate(el=>{el.scrollLeft=0;});const frame=(await rail.boundingBox())!,thumb=(await page.locator(".gallery-thumbnail").first().boundingBox())!;
      const cdp=await page.context().newCDPSession(page);await cdp.send("Emulation.setTouchEmulationEnabled",{enabled:true,maxTouchPoints:1});
      await cdp.send("Input.dispatchTouchEvent",{type:"touchStart",touchPoints:[{x:frame.x+frame.width-30,y:thumb.y+thumb.height/2,id:1}]});
      for(let step=1;step<=5;step++)await cdp.send("Input.dispatchTouchEvent",{type:"touchMove",touchPoints:[{x:frame.x+frame.width-30-step*25,y:thumb.y+thumb.height/2,id:1}]});
      await cdp.send("Input.dispatchTouchEvent",{type:"touchEnd",touchPoints:[]});
      await expect.poll(()=>rail.evaluate(el=>el.scrollLeft)).toBeGreaterThan(30);await expect(page.locator(".gallery-rail-region")).toHaveAttribute("data-sorting","false");expect(await order(page,target)).toEqual(before);
      await cdp.send("Emulation.setTouchEmulationEnabled",{enabled:false});await cdp.detach();
    }
    await rail.evaluate(el=>{el.scrollLeft=el.scrollWidth;});
    const last=page.locator(".gallery-thumbnail").last();await last.scrollIntoViewIfNeeded();await last.hover();const box=(await last.boundingBox())!,frame=(await rail.boundingBox())!;
    expect(await page.evaluate(({x,y})=>document.elementFromPoint(x,y)?.closest("button")?.className,{x:box.x+box.width/2,y:box.y+box.height/2})).toContain("gallery-thumbnail");
    await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.waitForTimeout(260);await expect(page.locator(".gallery-rail-region")).toHaveAttribute("data-sorting","true");
    await page.mouse.move(frame.x+5,box.y+box.height/2,{steps:15});await expect.poll(()=>rail.evaluate(el=>el.scrollLeft),{timeout:10_000}).toBeLessThan(2);await page.mouse.move(frame.x+30,box.y+box.height/2);await page.mouse.up();
    await expect.poll(async()=>(await order(page,target)).ids[0],{timeout:15_000}).toBe(before.ids.at(-1));
    expect((await order(page,target)).primary).toBe(before.primary);
    if(count>=10)await expect(page.locator('.gallery-add input[name="photo"]')).toHaveCount(0);
  }
});

test("M4A exit: Done protects meaningful edits, restores focus, saves once and validates origin",async({page})=>{
  test.setTimeout(120_000);const doneName="M4A synthetic exit seed";await seed(page,doneName);await page.getByRole("link",{name:doneName,exact:true}).click();await expect(page).toHaveURL(/\/items\/[a-f0-9-]{36}$/, {timeout:30_000});const itemUrl=page.url();
  await expect(page.getByRole("button",{name:messages.ru.saveChanges,exact:true})).toBeDisabled();
  await page.getByRole("link",{name:messages.ru.itemDone,exact:true}).click();await expect(page).toHaveURL(base);
  await page.getByRole("link",{name:doneName,exact:true}).click();await expect(page).toHaveURL(itemUrl);await page.getByLabel(messages.ru.itemModel,{exact:true}).fill("Pending model");
  await expect(page.getByRole("button",{name:messages.ru.saveChanges,exact:true})).toBeEnabled();// A prevented traversal has no load event; assert the guard, then the unchanged route.
  await page.evaluate(()=>history.back());await expect(page.getByRole("alertdialog")).toBeVisible();await expect(page).toHaveURL(itemUrl);await page.getByRole("alertdialog").getByRole("button",{name:messages.ru.itemLeaveStay,exact:true}).click();
  await expect(page.getByLabel(messages.ru.itemModel,{exact:true})).toHaveValue("Pending model");
  const done=page.getByRole("link",{name:messages.ru.itemDone,exact:true});await done.click();let dialog=page.getByRole("alertdialog");await dialog.getByRole("button",{name:messages.ru.itemLeaveStay,exact:true}).click();await expect(done).toBeFocused();
  await expect(page.getByLabel(messages.ru.itemModel,{exact:true})).toHaveValue("Pending model");
  await done.click();dialog=page.getByRole("alertdialog");await dialog.getByRole("button",{name:messages.ru.itemLeaveSave,exact:true}).click();await expect(page).toHaveURL(base);
  await page.goto(itemUrl);await expect(page.getByLabel(messages.ru.itemModel,{exact:true})).toHaveValue("Pending model");
  await page.getByLabel(messages.ru.itemModel,{exact:true}).fill("Discarded model");await page.getByRole("link",{name:messages.ru.itemDone,exact:true}).click();await page.getByRole("alertdialog").getByRole("button",{name:messages.ru.itemLeaveDiscard,exact:true}).click();await expect(page).toHaveURL(base);
  await page.goto(itemUrl+"?from=11111111-1111-4111-8111-111111111111");await expect(page.getByRole("link",{name:messages.ru.itemDone,exact:true})).toHaveAttribute("href",base);
  await expect(page.getByLabel(messages.ru.itemModel,{exact:true})).toHaveValue("Pending model");
  await page.goto(base+"/collections");await page.locator(".collection-create-trigger").click();const create=page.getByRole("dialog",{name:messages.ru.collectionCreate,exact:true});await create.getByLabel(messages.ru.collectionName).fill("M4A safe return origin");await create.getByRole("button",{name:messages.ru.collectionCreate,exact:true}).click();await expect(page).toHaveURL(/\/collections\/[a-f0-9-]{36}$/, {timeout:30_000});const origin=new URL(page.url()).pathname;await page.goto(itemUrl+"?from="+origin.split("/").at(-1));await expect(page.getByRole("link",{name:messages.ru.itemDone,exact:true})).toHaveAttribute("href",origin);await page.getByRole("link",{name:messages.ru.itemDone,exact:true}).click();await expect(page).toHaveURL(origin);
});


test("M4A emulated touch separates swipe, short press and hold sorting; keyboard cancels",async({page,context})=>{
  test.setTimeout(180_000);const label="M4A synthetic touch seed";const bytes=await seed(page,label);const target=await importFixture(page,galleryFixture(bytes,label,3),3,label);
  await page.setViewportSize({width:390,height:820});await expect(page.locator(".gallery-thumbnail")).toHaveCount(3);
  const cdp=await context.newCDPSession(page);await cdp.send("Emulation.setTouchEmulationEnabled",{enabled:true,maxTouchPoints:1});
  const touch=async(type:"touchStart"|"touchMove"|"touchEnd"|"touchCancel",x?:number,y?:number)=>{await cdp.send("Input.dispatchTouchEvent",{type,touchPoints:x===undefined||y===undefined?[]:[{x,y,id:1,radiusX:1,radiusY:1}]});};
  const before=await order(page,target);await page.locator(".gallery-thumbnail").first().click();
  await page.locator(".photo-viewer-image").scrollIntoViewIfNeeded();
  const image=(await page.locator(".photo-viewer-image").boundingBox())!,y=image.y+image.height/2;
  await touch("touchStart",image.x+image.width-50,y);for(let step=1;step<=5;step++)await touch("touchMove",image.x+image.width-50-step*22,y);await touch("touchEnd");
  await expect(page.locator(".gallery-counter")).toHaveText("2 / 3");expect(await order(page,target)).toEqual(before);
  await expect(page.getByRole("dialog",{name:messages.ru.photoViewer,exact:true})).toHaveCount(0);
  await page.locator(".gallery-thumbnail").first().scrollIntoViewIfNeeded();
  const first=(await page.locator(".gallery-thumbnail").first().boundingBox())!;
  await touch("touchStart",first.x+first.width/2,first.y+first.height/2);await page.waitForTimeout(150);await expect(page.locator(".gallery-rail-region")).toHaveAttribute("data-sorting","false");await touch("touchEnd");expect(await order(page,target)).toEqual(before);
  await touch("touchStart",first.x+first.width/2,first.y+first.height/2);await page.waitForTimeout(420);await expect(page.locator(".gallery-rail-region")).toHaveAttribute("data-sorting","true");await expect(page.locator(".gallery-primary-button").first()).toBeDisabled();await expect(page.getByText(messages.ru.galleryDragPosition.replace("{number}","1").replace("{total}","3"),{exact:true})).toHaveCount(1);
  const last=(await page.locator(".gallery-thumbnail").last().boundingBox())!;for(let step=1;step<=10;step++)await touch("touchMove",first.x+first.width/2+(last.x-first.x)*step/10,first.y+first.height/2);await touch("touchEnd");
  await expect.poll(async()=>(await order(page,target)).ids.at(-1),{timeout:15_000}).toBe(before.ids[0]);expect((await order(page,target)).primary).toBe(before.primary);
  const committed=await order(page,target);await page.locator(".gallery-thumbnail").first().scrollIntoViewIfNeeded();const cancelBox=(await page.locator(".gallery-thumbnail").first().boundingBox())!;await touch("touchStart",cancelBox.x+cancelBox.width/2,cancelBox.y+cancelBox.height/2);await page.waitForTimeout(420);await expect(page.locator(".gallery-rail-region")).toHaveAttribute("data-sorting","true");await touch("touchCancel");await expect(page.locator(".gallery-rail-region")).toHaveAttribute("data-sorting","false");expect(await order(page,target)).toEqual(committed);
  await page.emulateMedia({reducedMotion:"reduce"});await page.locator(".gallery-thumbnail").first().focus();await page.keyboard.press("Space");await page.keyboard.press("ArrowRight");await page.keyboard.press("Escape");const stable=await order(page,target);
  await page.locator(".gallery-thumbnail").first().focus();await page.keyboard.press("Enter");await expect(page.locator(".gallery-rail-region")).toHaveAttribute("data-sorting","true");await page.evaluate(()=>window.dispatchEvent(new Event("blur")));await expect(page.locator(".gallery-rail-region")).toHaveAttribute("data-sorting","false");expect(await order(page,target)).toEqual(stable);
});

test("M4A pending photo exit waits for persistence and never enables an unrelated Details save",async({page})=>{
  test.setTimeout(180_000);const label="M4A synthetic pending seed";await seed(page,label);await page.getByRole("link",{name:label,exact:true}).click();await expect(page).toHaveURL(/\/items\/[a-f0-9-]{36}$/);
  let release!:()=>void;const gate=new Promise<void>(resolve=>{release=resolve;});let intercepted=false;
  await page.route("**/items/**",async route=>{if(route.request().method()==="POST"&&route.request().headers()["next-action"]){intercepted=true;await gate;}await route.continue();});
  try{
    await page.locator('.gallery-add input[name="photo"]').setInputFiles({name:"synthetic-pending.png",mimeType:"image/png",buffer:await sharp({create:{width:300,height:240,channels:3,background:"#6b825a"}}).png().toBuffer()});
    const crop=page.getByRole("dialog",{name:messages.ru.cropTitle,exact:true});await expect(crop.getByRole("button",{name:messages.ru.cropConfirm,exact:true})).toBeEnabled();await crop.getByRole("button",{name:messages.ru.cropConfirm,exact:true}).click();
    await expect.poll(()=>intercepted).toBe(true);await expect(page.getByRole("button",{name:messages.ru.saveChanges,exact:true})).toBeDisabled();
    await page.getByRole("link",{name:messages.ru.itemDone,exact:true}).click();const dialog=page.getByRole("alertdialog");await expect(dialog).toContainText(messages.ru.itemLeavePending);await expect(dialog.getByRole("button",{name:messages.ru.itemLeaveDiscard,exact:true})).toHaveCount(0);
    release();await expect(page).toHaveURL(base,{timeout:30_000});const inventory=readInventoryArchive(await(await page.request.get(base+"/api/export/archive")).body()).inventory as PortableInventory;expect(inventory.items.find(item=>item.name===label)!.mediaAssets).toHaveLength(2);
  }finally{release();await page.unroute("**/items/**");}
});


test("M4A rejected reorder rolls back the displayed order without changing primary or media",async({page})=>{
  test.setTimeout(120_000);const label="M4A synthetic rejected sort";const bytes=await seed(page,label);const target=await importFixture(page,galleryFixture(bytes,label,3),3,label);await expect(page.locator(".gallery-thumbnail")).toHaveCount(3);const before=await order(page,target);
  let rewritten=false;await page.route("**/items/**",async route=>{const request=route.request();if(request.method()==="POST"&&request.headers()["next-action"]){const body=request.postData()??"";const changed=body.replace(/(name="_?[0-9]+_order"\r\n\r\n)[^\r\n]+/,"$1[]");if(changed!==body){rewritten=true;await route.continue({postData:changed});return;}}await route.continue();});
  try{await page.locator(".gallery-thumbnail").first().focus();await page.keyboard.press("Space");await expect(page.locator(".gallery-rail-region")).toHaveAttribute("data-sorting","true");await page.keyboard.press("ArrowRight");await expect(page.getByText(messages.ru.galleryDragPosition.replace("{number}","2").replace("{total}","3"),{exact:true})).toHaveCount(1);await page.keyboard.press("Space");await expect.poll(()=>rewritten).toBe(true);await expect(page.locator(".photo-gallery").getByRole("alert")).toBeVisible();await expect.poll(()=>page.locator(".gallery-thumb-wrap").evaluateAll(nodes=>nodes.map(node=>(node as HTMLElement).dataset.photoId))).toEqual(before.ids);await expect(page.locator(".gallery-thumbnail").first()).toBeFocused();expect(await order(page,target)).toEqual(before);}
  finally{await page.unroute("**/items/**");}
});


test.describe("explicit transport fault",()=>{
  test.use({expectedResourceErrors:["Failed to load resource: net::ERR_FAILED"]});
  test("M4A rejected upload retains File, source and preview for a safe retry",async({page})=>{
    test.setTimeout(180_000);const label="M4A synthetic transport seed";await seed(page,label);await page.getByRole("link",{name:label,exact:true}).click();await expect(page).toHaveURL(/\/items\/[a-f0-9-]{36}$/);
    let failed=false;await page.route("**/items/**",async route=>{if(!failed&&route.request().method()==="POST"&&route.request().headers()["next-action"]){failed=true;await route.abort("failed");return;}await route.continue();});
    try{
      const add=page.locator(".gallery-add");await add.locator('input[name="photo"]').setInputFiles({name:"synthetic-retry.png",mimeType:"image/png",buffer:await sharp({create:{width:340,height:260,channels:3,background:"#786c95"}}).png().toBuffer()});
      const crop=page.getByRole("dialog",{name:messages.ru.cropTitle,exact:true});await expect(crop.getByRole("button",{name:messages.ru.cropConfirm,exact:true})).toBeEnabled();await crop.getByRole("button",{name:messages.ru.cropConfirm,exact:true}).click();
      await expect(add.getByRole("alert")).toContainText(messages.ru.photoSaveGeneric);await expect.poll(()=>failed).toBe(true);
      expect(await add.locator('input[name="photo"]').evaluate((element:HTMLInputElement)=>element.files?.length)).toBe(1);expect(await add.locator('input[name="photoSource"]').evaluate((element:HTMLInputElement)=>element.files?.length)).toBe(1);await expect(add.locator('img[src^="blob:"]')).toBeVisible();await expect(page.locator(".gallery-thumbnail")).toHaveCount(1);
      await page.getByRole("link",{name:messages.ru.itemDone,exact:true}).click();await page.getByRole("alertdialog").getByRole("button",{name:messages.ru.itemLeaveStay,exact:true}).click();await add.getByRole("button",{name:messages.ru.retryUpload,exact:true}).click();
      await expect(page.locator(".gallery-thumbnail")).toHaveCount(2);expect(await add.locator('input[name="photo"]').evaluate((element:HTMLInputElement)=>element.files?.length)).toBe(0);await expect(page.getByRole("button",{name:messages.ru.saveChanges,exact:true})).toBeDisabled();
    }finally{await page.unroute("**/items/**");}
  });
});
