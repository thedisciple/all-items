import {expect,it} from "vitest";
import sharp from "sharp";
import {photoHeader,preflightPhoto} from "./browser-photo";

it("reads actual PNG, JPEG, lossy, lossless and extended WebP dimensions before preview",async()=>{
  const image=()=>sharp({create:{width:321,height:239,channels:4,background:{r:80,g:110,b:95,alpha:.7}}});
  for(const bytes of [await image().png().toBuffer(),await image().jpeg().toBuffer(),await image().removeAlpha().webp().toBuffer(),await image().webp({lossless:true}).toBuffer(),await image().withMetadata().webp().toBuffer()])expect(photoHeader(bytes)).toMatchObject({width:321,height:239});
  const bytes=await image().png().toBuffer(),file=new File([new Uint8Array(bytes)],"synthetic.png",{type:""});
  const inferred=await preflightPhoto(file);expect(inferred.type).toBe("image/png");expect(new Uint8Array(await inferred.arrayBuffer())).toEqual(new Uint8Array(bytes));
});
it("rejects malformed headers and oversized dimensions or bytes without decoding",async()=>{
  const bytes=await sharp({create:{width:100,height:100,channels:3,background:"#668877"}}).png().toBuffer();
  const excessive=Buffer.from(bytes);excessive.writeUInt32BE(12_001,16);expect(()=>photoHeader(excessive)).toThrow("photoPixelLimit");
  excessive.writeUInt32BE(10_000,16);excessive.writeUInt32BE(10_000,20);expect(()=>photoHeader(excessive)).toThrow("photoPixelLimit");
  expect(()=>photoHeader(new Uint8Array([0xff,0xd8,0xff,0xc0,0xff,0xff]))).toThrow("photoTypeInvalid");
  expect(()=>photoHeader(bytes.subarray(0,20))).toThrow("photoTypeInvalid");
  await expect(preflightPhoto(new File([new Uint8Array(10*1024*1024+1)],"synthetic.png",{type:"image/png"}))).rejects.toThrow("photoFileTooLarge");
});
