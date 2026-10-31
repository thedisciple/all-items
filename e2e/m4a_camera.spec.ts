import {test,expect} from "./helpers/browser-reliability";
import {messages} from "../src/i18n/messages";
import sharp from "sharp";

const base="/inventories/00000000-0000-4000-8000-000000000001";
test.use({launchOptions:{args:["--use-fake-device-for-media-stream","--use-fake-ui-for-media-stream"]}});
test.beforeEach(async({page})=>{
  await page.addInitScript(()=>{
    const state=window as Window&{__cameraStreams?:MediaStream[];__cameraRequests?:MediaStreamConstraints[]};state.__cameraStreams=[];state.__cameraRequests=[];
    const original=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia=async constraints=>{state.__cameraRequests!.push(constraints??{});const stream=await original(constraints);state.__cameraStreams!.push(stream);return stream;};
  });
});

test("M4A sequential simulated camera captures append three photos and stop every track",async({page})=>{
  test.setTimeout(240_000);await page.goto(base);await page.locator(".add-dialog-trigger").click();const add=page.getByRole("dialog",{name:messages.ru.addItem,exact:true});await add.getByLabel(messages.ru.itemName,{exact:true}).fill("M4A synthetic camera sequence");
  for(let index=0;index<3;index++){
    await add.getByRole("button",{name:messages.ru.addPhoto,exact:true}).click();const source=page.getByRole("dialog",{name:messages.ru.photo,exact:true});await source.getByRole("button",{name:messages.ru.cameraOpen,exact:true}).click();
    await expect.poll(()=>page.getByRole("dialog",{name:messages.ru.cameraCapture,exact:true}).locator("video").evaluate((video:HTMLVideoElement)=>video.videoWidth)).toBeGreaterThan(0);await page.getByRole("dialog",{name:messages.ru.cameraCapture,exact:true}).getByRole("button",{name:messages.ru.cameraCapture,exact:true}).click();
    const crop=page.getByRole("dialog",{name:messages.ru.cropTitle,exact:true});await expect(crop.getByRole("button",{name:messages.ru.cropConfirm,exact:true})).toBeEnabled();await crop.getByRole("button",{name:messages.ru.cropConfirm,exact:true}).click();await expect(add.locator(".gallery-thumbnail")).toHaveCount(index+1);
    expect(await page.evaluate(()=>((window as unknown as Window&{__cameraStreams:MediaStream[]}).__cameraStreams).every(stream=>stream.getTracks().every(track=>track.readyState==="ended")))).toBe(true);
  }
  expect(await page.evaluate(()=>((window as unknown as Window&{__cameraRequests:MediaStreamConstraints[]}).__cameraRequests).every(request=>request.audio===false&&Boolean(request.video)))).toBe(true);
  await add.getByRole("button",{name:messages.ru.saveItem,exact:true}).click();await expect(page).toHaveURL(/added=/,{timeout:60_000});await page.getByRole("link",{name:"M4A synthetic camera sequence",exact:true}).click();await expect(page.locator(".gallery-thumbnail")).toHaveCount(3);
});

test("M4A denied camera permission keeps fields and offers the normal multi-file picker",async({page})=>{
  test.setTimeout(120_000);await page.addInitScript(()=>{navigator.mediaDevices.getUserMedia=async()=>{throw new DOMException("Synthetic permission denial","NotAllowedError");};});
  await page.goto(base);await page.locator(".add-dialog-trigger").click();const add=page.getByRole("dialog",{name:messages.ru.addItem,exact:true});await add.getByLabel(messages.ru.itemModel,{exact:true}).fill("Kept after denied camera");
  await add.getByRole("button",{name:messages.ru.addPhoto,exact:true}).click();const source=page.getByRole("dialog",{name:messages.ru.photo,exact:true});await source.getByRole("button",{name:messages.ru.cameraOpen,exact:true}).click();await expect(source.getByRole("alert")).toContainText(messages.ru.cameraDenied);
  const chooser=page.waitForEvent("filechooser");await source.getByRole("button",{name:messages.ru.chooseFile,exact:true}).click();expect((await chooser).isMultiple()).toBe(true);
  await(await chooser).setFiles({name:"synthetic-fallback.png",mimeType:"image/png",buffer:await sharp({create:{width:320,height:240,channels:3,background:"#688572"}}).png().toBuffer()});
  const crop=page.getByRole("dialog",{name:messages.ru.cropTitle,exact:true});await expect(crop.getByRole("button",{name:messages.ru.cropConfirm,exact:true})).toBeEnabled();await crop.getByRole("button",{name:messages.ru.cropConfirm,exact:true}).click();await expect(add.getByLabel(messages.ru.itemModel,{exact:true})).toHaveValue("Kept after denied camera");await expect(add.locator(".gallery-thumbnail")).toHaveCount(1);
});

test("M4A camera encoding failure is recoverable and closing the source stops the stream",async({page})=>{
  test.setTimeout(120_000);await page.addInitScript(()=>{HTMLCanvasElement.prototype.toBlob=function(callback){callback(null);};});
  await page.goto(base);await page.locator(".add-dialog-trigger").click();const add=page.getByRole("dialog",{name:messages.ru.addItem,exact:true});await add.getByLabel(messages.ru.itemModel,{exact:true}).fill("Kept after capture failure");await add.getByRole("button",{name:messages.ru.addPhoto,exact:true}).click();
  const source=page.getByRole("dialog",{name:messages.ru.photo,exact:true});await source.getByRole("button",{name:messages.ru.cameraOpen,exact:true}).click();await expect.poll(()=>page.getByRole("dialog",{name:messages.ru.cameraCapture,exact:true}).locator("video").evaluate((video:HTMLVideoElement)=>video.videoWidth)).toBeGreaterThan(0);await page.getByRole("dialog",{name:messages.ru.cameraCapture,exact:true}).getByRole("button",{name:messages.ru.cameraCapture,exact:true}).click();const camera=page.getByRole("dialog",{name:messages.ru.cameraCapture,exact:true});await expect(camera.getByRole("alert")).toContainText(messages.ru.cameraCaptureFailed);await camera.getByRole("button",{name:messages.ru.close,exact:true}).click();
  expect(await page.evaluate(()=>((window as unknown as Window&{__cameraStreams:MediaStream[]}).__cameraStreams).every(stream=>stream.getTracks().every(track=>track.readyState==="ended")))).toBe(true);await expect(add.getByLabel(messages.ru.itemModel,{exact:true})).toHaveValue("Kept after capture failure");await expect(add.locator(".gallery-thumbnail")).toHaveCount(0);
});
