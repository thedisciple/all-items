import {browserSHA256} from "@/lib/browser-crypto";
import {creationCommandSchema,safePhotoName,type CreationCommand} from "@/items/creation-command";
import type {DraftFields,GalleryDraftRecord} from "./recovery-store";

const descriptors=new WeakMap<File,Promise<CreationCommand["photos"][number]["selected"]>>();
export function describePhoto(file:File){
  let result=descriptors.get(file);
  if(!result){result=(async()=>({sha256:await browserSHA256(await file.arrayBuffer()),size:file.size,name:safePhotoName(file.name),type:file.type as "image/png"|"image/jpeg"|"image/webp"}))();descriptors.set(file,result);}
  return result;
}

export async function creationRequest(inventoryId:string,operationId:string,fields:DraftFields,rows:GalleryDraftRecord["rows"],categoryPresentation:GalleryDraftRecord["categoryPresentation"],gallery:{photos:{id:string;selected:File|null;source:File|null;pending:File|null;crop:CreationCommand["photos"][number]["crop"]}[];primaryId:string|null}):Promise<CreationCommand>{
  const photos:CreationCommand["photos"]=[];
  for(const photo of gallery.photos){
    if(!photo.selected||photo.pending)throw new Error("Finish the pending crop before saving");
    photos.push({id:photo.id,selected:await describePhoto(photo.selected),source:await describePhoto(photo.source??photo.selected),crop:photo.crop});
  }
  return creationCommandSchema.parse({version:1,inventoryId,operationId,fields,rows,categoryPresentation,photos,primaryId:gallery.primaryId});
}
