import {z} from "zod";
import {cropDataSchema} from "@/media/crop-data";
import {MAX_CREATION_PHOTO_BYTES,NEW_ITEM_PHOTO_LIMIT} from "@/media/limits";
import {draftFieldsSchema} from "./draft-fields";

export const photoDescriptorSchema=z.object({
  sha256:z.string().regex(/^[a-f0-9]{64}$/),size:z.number().int().min(1).max(10*1024*1024),
  name:z.string().min(1).max(255),type:z.enum(["image/jpeg","image/png","image/webp"]),
});
export const creationPhotoSchema=z.object({id:z.uuid(),selected:photoDescriptorSchema,source:photoDescriptorSchema,crop:cropDataSchema.nullable()});
export const creationCommandSchema=z.object({
  version:z.literal(1),inventoryId:z.uuid(),operationId:z.uuid(),fields:draftFieldsSchema,
  rows:z.array(z.object({location:z.string().max(120),quantity:z.string().max(7)})).min(1).max(50),
  categoryPresentation:z.array(z.object({category:z.string().min(1).max(80),emoji:z.string().max(32)})).max(20),
  photos:z.array(creationPhotoSchema).max(NEW_ITEM_PHOTO_LIMIT),primaryId:z.uuid().nullable(),
}).superRefine((command,context)=>{
  const ids=new Set(command.photos.map(photo=>photo.id));
  if(ids.size!==command.photos.length||command.photos.length>0&&(!command.primaryId||!ids.has(command.primaryId))||!command.photos.length&&command.primaryId!==null)context.addIssue({code:"custom",message:"Invalid creation gallery"});
  if(!command.fields.name.trim()&&!command.photos.length)context.addIssue({code:"custom",message:"A name or photo is required"});
  const inputs=new Map<string,number>();
  for(const photo of command.photos)for(const descriptor of [photo.selected,photo.source]){
    const existing=inputs.get(descriptor.sha256);
    if(existing!==undefined&&existing!==descriptor.size)context.addIssue({code:"custom",message:"Inconsistent input digest"});
    inputs.set(descriptor.sha256,descriptor.size);
  }
  if([...inputs.values()].reduce((total,size)=>total+size,0)>MAX_CREATION_PHOTO_BYTES)context.addIssue({code:"custom",message:"Creation input budget exceeded"});
});
export type CreationCommand=z.infer<typeof creationCommandSchema>;
export type CreationPhoto=z.infer<typeof creationPhotoSchema>;

export function canonicalJSON(value:unknown):string{
  return JSON.stringify(value,(_key,entry)=>entry!==null&&typeof entry==="object"&&!Array.isArray(entry)?Object.fromEntries(Object.entries(entry).sort(([a],[b])=>a<b?-1:a>b?1:0)):entry);
}

export function safePhotoName(name:string){return(name.replaceAll("\\","/").split("/").at(-1)??"").replace(/[\u0000-\u001f\u007f]/g,"").slice(0,255)||"photo";}
