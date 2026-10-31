import {z} from "zod";

const maximumBytes=10*1024*1024;
const dimensions=z.object({width:z.number().int().positive().max(12_000),height:z.number().int().positive().max(12_000)}).refine(value=>value.width*value.height<=40_000_000);
export class PhotoInputError extends Error{
  constructor(public readonly code:"photoFileTooLarge"|"photoTypeInvalid"|"photoPixelLimit"){super(code);}
}
type Size={width:number;height:number};
const sof=new Set([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf]);

// Header preflight bounds normal preview inputs; this is not a complete image decoder.
// Browser decoding and server-side Sharp validation remain authoritative.
export function photoHeader(bytes:Uint8Array):Size&{type:"image/png"|"image/jpeg"|"image/webp"}{
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  const text=(offset:number,length:number)=>String.fromCharCode(...bytes.subarray(offset,offset+length));
  const size=(width:number,height:number)=>{if(!dimensions.safeParse({width,height}).success)throw new PhotoInputError("photoPixelLimit");return{width,height};};
  if(bytes.length>=33&&[137,80,78,71,13,10,26,10].every((value,index)=>bytes[index]===value)&&view.getUint32(8)===13&&text(12,4)==="IHDR")return{...size(view.getUint32(16),view.getUint32(20)),type:"image/png"};
  if(bytes[0]===0xff&&bytes[1]===0xd8){
    let offset=2;
    while(offset+1<bytes.length){
      if(bytes[offset++]!==0xff)break;
      while(bytes[offset]===0xff)offset++;
      const marker=bytes[offset++];if(marker===undefined||marker===0xda||marker===0xd9)break;
      if(marker===0x01||marker>=0xd0&&marker<=0xd7)continue;
      if(offset+2>bytes.length)break;const length=view.getUint16(offset);
      if(length<2||offset+length>bytes.length)break;
      if(sof.has(marker)&&length>=8)return{...size(view.getUint16(offset+5),view.getUint16(offset+3)),type:"image/jpeg"};
      offset+=length;
    }
  }
  if(bytes.length>=20&&text(0,4)==="RIFF"&&text(8,4)==="WEBP"){
    const end=view.getUint32(4,true)+8;
    if(end>bytes.length||end<20)throw new PhotoInputError("photoTypeInvalid");
    const uint24=(offset:number)=>bytes[offset]!+bytes[offset+1]!*256+bytes[offset+2]!*65536;
    let canvas:Size|null=null,frame:Size|null=null;
    const stream=(kind:string,start:number,length:number)=>{
      if(kind==="VP8L"&&length>=5&&bytes[start]===0x2f){const bits=view.getUint32(start+1,true);return size((bits&0x3fff)+1,((bits>>>14)&0x3fff)+1);}
      if(kind==="VP8 "&&length>=10&&(bytes[start]!&1)===0&&bytes[start+3]===0x9d&&bytes[start+4]===1&&bytes[start+5]===0x2a)return size(view.getUint16(start+6,true)&0x3fff,view.getUint16(start+8,true)&0x3fff);
      throw new PhotoInputError("photoTypeInvalid");
    };
    for(let offset=12;offset+8<=end;){
      const kind=text(offset,4),length=view.getUint32(offset+4,true),start=offset+8;
      if(start+length>end)throw new PhotoInputError("photoTypeInvalid");
      if(kind==="VP8X"&&length>=10)canvas=size(uint24(start+4)+1,uint24(start+7)+1);
      if(kind==="VP8 "||kind==="VP8L")frame=stream(kind,start,length);
      if(kind==="ANMF"){
        if(length<16)throw new PhotoInputError("photoTypeInvalid");
        const bounds=size(uint24(start+6)+1,uint24(start+9)+1);
        if(!canvas||uint24(start)*2+bounds.width>canvas.width||uint24(start+3)*2+bounds.height>canvas.height)throw new PhotoInputError("photoPixelLimit");
        for(let sub=start+16;sub+8<=start+length;){
          const subKind=text(sub,4),subSize=view.getUint32(sub+4,true),data=sub+8;
          if(data+subSize>start+length)throw new PhotoInputError("photoTypeInvalid");
          if(subKind==="VP8 "||subKind==="VP8L"){const decoded=stream(subKind,data,subSize);if(decoded.width!==bounds.width||decoded.height!==bounds.height)throw new PhotoInputError("photoTypeInvalid");frame=decoded;}
          sub=data+subSize+(subSize&1);
        }
      }
      offset=start+length+(length&1);
    }
    if(frame)return{...(canvas??frame),type:"image/webp"};
  }
  throw new PhotoInputError("photoTypeInvalid");
}

export async function preflightPhoto(file:File){
  if(!file.size||file.size>maximumBytes)throw new PhotoInputError("photoFileTooLarge");
  const header=photoHeader(new Uint8Array(await file.arrayBuffer()));
  return file.type===header.type?file:new File([file],file.name,{type:header.type,lastModified:file.lastModified});
}

const thumbnails=new WeakMap<File,Promise<Blob>>();
let work:Promise<unknown>=Promise.resolve();
export function draftThumbnail(file:File):Promise<Blob>{
  const cached=thumbnails.get(file);if(cached)return cached;
  const operation=work.then(async()=>{
    await preflightPhoto(file);
    // Decode one bounded source at a time; orientation comes from the browser.
    const bitmap=await createImageBitmap(file),canvas=document.createElement("canvas");
    try{
      const scale=Math.min(160/bitmap.width,160/bitmap.height,1);
      canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));
      const context=canvas.getContext("2d");if(!context)throw new Error("Thumbnail canvas unavailable");context.drawImage(bitmap,0,0,canvas.width,canvas.height);
      const blob=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,"image/webp",.76));if(!blob)throw new Error("Thumbnail encoding failed");return blob;
    }finally{bitmap.close();canvas.width=0;canvas.height=0;}
  });
  work=operation.catch(()=>{});thumbnails.set(file,operation);return operation;
}
