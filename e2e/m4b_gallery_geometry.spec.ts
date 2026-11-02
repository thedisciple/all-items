import { expect, test } from "./helpers/browser-reliability";
import type { Locator } from "@playwright/test";
import sharp from "sharp";
import { messages } from "../src/i18n/messages";

const base = "/inventories/00000000-0000-4000-8000-000000000001";
async function marked(width:number,height:number) {
  const vertical=height>width, length=vertical?height:width, edge=Math.max(1,Math.round(length*.2));
  const rect=(start:number,size:number,color:string)=>({input:Buffer.from('<svg width="'+width+'" height="'+height+'"><rect x="'+(vertical?0:start)+'" y="'+(vertical?start:0)+'" width="'+(vertical?width:size)+'" height="'+(vertical?size:height)+'" fill="'+color+'"/></svg>'),left:0,top:0});
  return sharp({create:{width,height,channels:3,background:"#20d020"}}).composite([rect(0,edge,"#ee2020"),rect(length-edge,edge,"#2020ee")]).png().toBuffer();
}
async function verify(thumbs:Locator) {
  await expect(thumbs).toHaveCount(7);
  for(let i=0;i<7;i++) {
    const image=thumbs.nth(i).locator('img'); await expect(image).toBeVisible();
    const css=await image.evaluate(el=>{const s=getComputedStyle(el),r=el.getBoundingClientRect();return {fit:s.objectFit,position:s.objectPosition,width:r.width,height:r.height};});
    expect(css.fit).toBe('contain'); expect(css.position).toBe('50% 50%'); expect(css.width).toBeLessThanOrEqual(64);expect(css.height).toBeLessThanOrEqual(64);
    const {data,info}=await sharp(await image.screenshot()).removeAlpha().raw().toBuffer({resolveWithObject:true});
    const found=[false,false,false];for(let j=0;j<data.length;j+=info.channels){const r=data[j]!,g=data[j+1]!,b=data[j+2]!;if(r>100&&r>g*1.4&&r>b*1.4)found[0]=true;if(g>90&&g>r*1.4&&g>b*1.4)found[1]=true;if(b>100&&b>r*1.4&&b>g*1.4)found[2]=true;}
    expect(found,'all edge and center markers visible in image '+i).toEqual([true,true,true]);
  }
}
test('draft and persisted gallery thumbnails contain all marked image edges',async({page})=>{
  test.setTimeout(240_000);await page.goto(base);await page.locator('.add-dialog-trigger').click();const dialog=page.getByRole('dialog',{name:messages.ru.addItem,exact:true});
  const sizes=[[40,400],[40,800],[400,40],[800,40],[400,300],[300,400],[300,300]];
  const files=await Promise.all(sizes.map(async([w,h],i)=>({name:'synthetic-'+i+'.png',mimeType:'image/png',buffer:await marked(w!,h!)})));
  await dialog.locator('input[name="photo"]').setInputFiles(files);await verify(dialog.locator('.gallery-thumbnail'));
  await dialog.getByLabel(messages.ru.itemName,{exact:true}).fill('M4B synthetic aspect ratios');await dialog.getByRole('button',{name:messages.ru.saveItem,exact:true}).click();await expect(page).toHaveURL(/added=/,{timeout:60000});
  await page.getByRole('link',{name:'M4B synthetic aspect ratios',exact:true}).click();await verify(page.locator('.gallery-thumbnail'));
  await expect(page.locator('.item-edit-form .form-action-row')).toBeHidden();
  const edit=page.locator('.photo-edit-primary'),remove=page.getByRole('button',{name:messages.ru.photoDelete,exact:true});const e=await edit.boundingBox(),d=await remove.boundingBox();expect(e&&d).toBeTruthy();expect(Math.abs(e!.y-d!.y)).toBeLessThan(5);expect(d!.width).toBeGreaterThanOrEqual(44);expect(d!.height).toBeGreaterThanOrEqual(44);
});
