import { expect,test } from "@playwright/test";
import sharp from "sharp";

type Rectangle={x:number;y:number;width:number;height:number};
const markers=[[220,30,30],[25,195,45],[35,70,225],[225,205,25]] as const;

async function synthetic(width:number,height:number,crop:Rectangle) {
  const positions=[[.15,.15],[.85,.15],[.15,.85],[.85,.85]];
  const shapes=positions.map(([x,y],i)=>`<rect x="${crop.x+crop.width*(x!-.1)}" y="${crop.y+crop.height*(y!-.1)}" width="${crop.width*.2}" height="${crop.height*.2}" fill="rgb(${markers[i]!.join(",")})"/>`).join("");
  return sharp({create:{width,height,channels:3,background:"#888888"}}).composite([{input:Buffer.from(`<svg width="${width}" height="${height}">${shapes}</svg>`)}]).png().toBuffer();
}

function checkMarkers(pixels:number[][]) {
  for(const [i,expected] of markers.entries()) for(let channel=0;channel<3;channel++) expect(Math.abs(pixels[i]![channel]!-expected[channel]!)).toBeLessThan(55);
}

test("crop output, contained preview and saved image preserve marked edges and aspect ratios",async({page})=>{
  test.setTimeout(180_000);
  const cases=[
    {name:"portrait",width:400,height:800,crop:{x:50,y:100,width:300,height:600}},
    {name:"landscape",width:800,height:400,crop:{x:100,y:50,width:600,height:300}},
    {name:"tall",width:200,height:1000,crop:{x:20,y:100,width:160,height:800}},
    {name:"wide",width:2000,height:100,crop:{x:0,y:0,width:2000,height:100}},
  ];
  for(const fixture of cases) {
    await page.goto("/inventories/00000000-0000-4000-8000-000000000001");
    await page.locator(".add-dialog-trigger").click();
    const dialog=page.getByRole("dialog",{name:"Добавить вещь"});
    await dialog.getByRole("button",{name:"Добавить фото",exact:true}).click();
    await expect(page.getByRole("dialog",{name:"Фотография"}).getByRole("button",{name:"Отмена"})).toHaveCount(0);
    await page.locator('input[name="photo"]').setInputFiles({name:`${fixture.name}.png`,mimeType:"image/png",buffer:await synthetic(fixture.width,fixture.height,fixture.crop)});
    const crop=page.getByRole("dialog",{name:"Редактировать фото"});
    await expect(crop.getByRole("button",{name:"Готово"})).toBeEnabled();
    await crop.locator(".photo-cropper-widget").evaluate((root,rect)=>{
      const image=root.querySelector(":scope > img") as HTMLImageElement & {cropper:{setData:(value:Rectangle)=>void}};
      image.cropper.setData(rect);
    },fixture.crop);
    await expect.poll(()=>crop.locator(".photo-cropper-widget").evaluate(root=>{
      const image=root.querySelector(":scope > img") as HTMLImageElement & {cropper:{getData:(rounded:boolean)=>Rectangle}};
      return image.cropper.getData(true).width;
    })).toBe(fixture.crop.width);
    await crop.getByRole("button",{name:"Готово"}).click();
    const preview=dialog.locator(".photo-preview-frame");
    await expect(preview.locator('[data-image-state="loaded"]')).toBeVisible();
    const fileState=await dialog.locator('input[name="photo"]').evaluate(async element=>{
      const file=(element as HTMLInputElement).files![0]!,image=await createImageBitmap(file),canvas=document.createElement("canvas");
      canvas.width=image.width;canvas.height=image.height;const ctx=canvas.getContext("2d")!;ctx.drawImage(image,0,0);
      const pixels=[[.15,.15],[.85,.15],[.15,.85],[.85,.85]].map(([x,y])=>Array.from(ctx.getImageData(Math.floor(image.width*x!),Math.floor(image.height*y!),1,1).data).slice(0,3));
      return {width:image.width,height:image.height,pixels};
    });
    expect(fileState.width).toBe(fixture.crop.width);expect(fileState.height).toBe(fixture.crop.height);checkMarkers(fileState.pixels);
    if(fixture.name==="portrait") {
      const previous=await preview.evaluate(frame=>{
        const image=frame.querySelector("img")!,container=frame.querySelector<HTMLElement>(".media-preview")!,imageStyle=image.style.cssText,containerStyle=container.style.cssText;
        container.style.gridTemplateRows="auto";container.style.gridTemplateColumns="auto";image.style.minHeight="auto";image.style.minWidth="auto";image.style.maxHeight="none";
        const result={imageHeight:image.getBoundingClientRect().height,frameHeight:container.getBoundingClientRect().height};
        image.style.cssText=imageStyle;container.style.cssText=containerStyle;return result;
      });
      expect(previous.imageHeight).toBeGreaterThan(previous.frameHeight);
    }
    const geometry=await preview.evaluate(frame=>{const image=frame.querySelector("img")!,container=frame.querySelector(".media-preview")!,a=image.getBoundingClientRect(),b=container.getBoundingClientRect(),c=frame.getBoundingClientRect();return {image:{x:a.x,y:a.y,width:a.width,height:a.height},container:{x:b.x,y:b.y,width:b.width,height:b.height},frame:{x:c.x,y:c.y,width:c.width,height:c.height},fit:getComputedStyle(image).objectFit};});
    expect(geometry.fit).toBe("contain");expect(geometry.image.height).toBeLessThanOrEqual(geometry.container.height+1);
    const bitmap=await sharp(await preview.screenshot()).removeAlpha().raw().toBuffer({resolveWithObject:true});
    const scale=Math.min(geometry.image.width/fileState.width,geometry.image.height/fileState.height);
    const rendered={width:fileState.width*scale,height:fileState.height*scale};
    const left=geometry.image.x-geometry.frame.x+(geometry.image.width-rendered.width)/2;
    const top=geometry.image.y-geometry.frame.y+(geometry.image.height-rendered.height)/2;
    const shown=[[.15,.15],[.85,.15],[.15,.85],[.85,.85]].map(([x,y])=>{const px=Math.floor(left+rendered.width*x!),py=Math.floor(top+rendered.height*y!),offset=(py*bitmap.info.width+px)*bitmap.info.channels;return [...bitmap.data.subarray(offset,offset+3)];});
    checkMarkers(shown);
    if(fixture.name==="portrait") {
      await dialog.getByRole("button",{name:"Выбрать другое фото"}).click();
      await dialog.locator('input[name="photo"]').setInputFiles({name:"replacement.png",mimeType:"image/png",buffer:await synthetic(400,800,fixture.crop)});
      const replacement=page.getByRole("dialog",{name:"Редактировать фото"});
      await expect(replacement.getByRole("button",{name:"Готово"})).toBeEnabled();
      await replacement.locator(".crop-actions").getByRole("button",{name:"Отмена"}).click();
      await expect(preview.locator('[data-image-state="loaded"]')).toBeVisible();
      const retained=await dialog.locator('input[name="photo"]').evaluate(element=>(element as HTMLInputElement).files![0]!.name);
      expect(retained).toContain("portrait");
    }
    await dialog.getByLabel("Название").fill(`Marked ${fixture.name}`);
    await dialog.getByRole("button",{name:"Сохранить вещь",exact:true}).click();
    await expect(page).toHaveURL(/added=/);
    await page.getByRole("link",{name:`Marked ${fixture.name}`,exact:true}).click();
    const image=page.locator(".photo-viewer-image img");await expect(image).toBeVisible();
    const response=await page.request.get((await image.getAttribute("src"))!);expect(response.status()).toBe(200);
    const decoded=await sharp(await response.body()).removeAlpha().raw().toBuffer({resolveWithObject:true});
    expect(decoded.info.width).toBe(fileState.width);expect(decoded.info.height).toBe(fileState.height);
    const saved=[[.15,.15],[.85,.15],[.15,.85],[.85,.85]].map(([x,y])=>{const offset=(Math.floor(decoded.info.height*y!)*decoded.info.width+Math.floor(decoded.info.width*x!))*decoded.info.channels;return [...decoded.data.subarray(offset,offset+3)];});
    checkMarkers(saved);
  }
});
