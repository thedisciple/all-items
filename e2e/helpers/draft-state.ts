import type {Page} from "@playwright/test";

export const itemDraftKey="00000000-0000-4000-8000-000000000001:add-item";
export async function draftSnapshot(page:Page,key=itemDraftKey){
  return page.evaluate(async key=>{
    type StoredFile={data:Blob;name:string;lastModified:number};
    type Crop={x:number;y:number;width:number;height:number;rotate:number;scaleX:number;scaleY:number};
    type Record={version:number;revision:string;operationId?:string;fields:{name:string;model:string};primaryId?:string;selectedId?:string;visibleIndex?:number;photos?:{id:string;selected:StoredFile|null;source:StoredFile|null;pending:StoredFile|null;crop:Crop|null;pendingCrop:Crop|null}[]};
    const record=await new Promise<Record|null>((resolve,reject)=>{
      const request=indexedDB.open("all-items-drafts",1);request.onerror=()=>reject(request.error);
      request.onsuccess=()=>{const db=request.result;try{const query=db.transaction("drafts").objectStore("drafts").get(key);query.onsuccess=()=>{resolve(query.result??null);db.close();};query.onerror=()=>{reject(query.error);db.close();};}catch(error){db.close();reject(error);}};
    });
    if(!record)return null;
    const describe=async(file:StoredFile|null)=>file?{name:file.name,size:file.data.size,sha256:[...new Uint8Array(await crypto.subtle.digest("SHA-256",await file.data.arrayBuffer()))].map(byte=>byte.toString(16).padStart(2,"0")).join("")}:null;
    return{version:record.version,revision:record.revision,operationId:record.operationId,fields:record.fields,primaryId:record.primaryId,selectedId:record.selectedId,visibleIndex:record.visibleIndex,photos:await Promise.all((record.photos??[]).map(async photo=>({id:photo.id,crop:photo.crop,pendingCrop:photo.pendingCrop,selected:await describe(photo.selected),source:await describe(photo.source),pending:await describe(photo.pending)})))};
  },key);
}
