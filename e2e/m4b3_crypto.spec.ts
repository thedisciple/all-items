import {test,expect} from "./helpers/browser-reliability";
import sharp from "sharp";
import {messages} from "../src/i18n/messages";
const base="/inventories/00000000-0000-4000-8000-000000000001";
test("synthetic browser without randomUUID or SubtleCrypto can create a photo item",async({page})=>{
  test.setTimeout(120_000);
  await page.addInitScript(()=>{Object.defineProperty(Crypto.prototype,"randomUUID",{value:undefined,configurable:true});Object.defineProperty(Crypto.prototype,"subtle",{get:()=>undefined,configurable:true});});
  await page.goto(base);await page.locator(".add-dialog-trigger").click();const dialog=page.getByRole("dialog",{name:messages.ru.addItem,exact:true});await dialog.getByLabel(messages.ru.itemName,{exact:true}).fill("Synthetic HTTP crypto fallback");
  const buffer=await sharp({create:{width:200,height:150,channels:3,background:"#637e69"}}).png().toBuffer();
  await dialog.locator('input[name="photo"]').setInputFiles({name:"synthetic.png",mimeType:"image/png",buffer});const crop=page.getByRole("dialog",{name:messages.ru.cropTitle});await expect(crop.getByRole("button",{name:messages.ru.cropConfirm,exact:true})).toBeEnabled();await crop.getByRole("button",{name:messages.ru.cropConfirm,exact:true}).click();
  await dialog.getByRole("button",{name:messages.ru.saveItem,exact:true}).click();await expect(page.getByRole("link",{name:"Synthetic HTTP crypto fallback",exact:true})).toBeVisible({timeout:60_000});
});

test("insecure context offers file picker instead of starting camera",async({page})=>{await page.addInitScript(()=>Object.defineProperty(window,"isSecureContext",{value:false,configurable:true}));await page.goto(base);await page.locator(".add-dialog-trigger").click();const add=page.getByRole("dialog",{name:messages.ru.addItem,exact:true});await add.getByRole("button",{name:messages.ru.addPhoto,exact:true}).click();const source=page.getByRole("dialog",{name:messages.ru.photo,exact:true});await source.getByRole("button",{name:messages.ru.cameraOpen,exact:true}).click();await expect(source.getByRole("alert")).toContainText(messages.ru.secureCamera);await expect(source.getByRole("button",{name:messages.ru.chooseFile,exact:true})).toBeVisible();});
