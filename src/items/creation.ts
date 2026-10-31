import type {Client} from "@libsql/client";
import {createHash,randomUUID} from "node:crypto";
import {lstat,mkdir,open,readFile,readdir,rename,rm,rmdir} from "node:fs/promises";
import path from "node:path";
import {z} from "zod";
import {dataDirectory} from "@/db/client";
import {assertPrivatePath} from "@/media/private-paths";
import {normalizeItemPhoto,privateItemAssetPaths} from "@/media/service";
import {NEW_ITEM_PHOTO_LIMIT} from "@/media/limits";
import {inventoryDatabase} from "./inventories";
import type {InventoryContext} from "./inventory-context";
import {createItem,photoFirstItemValues,validateItemCreation} from "./service";
import {canonicalJSON,creationCommandSchema,creationPhotoSchema,safePhotoName,type CreationCommand,type CreationPhoto} from "./creation-command";
import {readWriteReceipt,WriteReceiptDeleted,type WriteIdentity,type WriteResult} from "./write-receipts";
import {withInventoryOperation} from "./operation-lock";

export const CREATION_STAGE_LIMITS={operations:64,totalBytes:256*1024*1024,operationBytes:64*1024*1024,assetBytes:32*1024*1024,lifetime:24*60*60*1000} as const;
const variants=["image","thumbnail","source"] as const;
type Variant=typeof variants[number];
const checksum=z.object({size:z.number().int().min(1).max(CREATION_STAGE_LIMITS.assetBytes),sha256:z.string().regex(/^[a-f0-9]{64}$/)});
const stagedPhotoSchema=z.object({input:creationPhotoSchema,mediaId:z.uuid(),width:z.number().int().positive().max(2400),height:z.number().int().positive().max(2400),cropData:z.string().max(1000).nullable(),originalFilename:z.string().max(255),assets:z.object({image:checksum,thumbnail:checksum,source:checksum})});
const manifestSchema=z.object({version:z.literal(1),workspaceId:z.uuid(),operationId:z.uuid(),itemId:z.uuid(),requestHash:z.string().regex(/^[a-f0-9]{64}$/),updatedAt:z.number().finite(),promoting:z.boolean(),photos:z.array(stagedPhotoSchema).max(NEW_ITEM_PHOTO_LIMIT)});
type Manifest=z.infer<typeof manifestSchema>;
type StagedPhoto=z.infer<typeof stagedPhotoSchema>;
export class CreationStageError extends Error {constructor(message:string,public readonly code:"invalid"|"capacity"="invalid"){super(message);}}
const hash=(bytes:Uint8Array|string)=>createHash("sha256").update(bytes).digest("hex");
const uuid=z.uuid();
const safeStageFile=/^(?:manifest\.json|manifest-[a-f0-9-]{36}\.tmp|[a-f0-9-]{36}-(?:image|thumbnail|source)\.webp)$/;
function stageRoot(directory:string){return path.join(directory,"creation-staging");}
function operationFolder(directory:string,workspaceId:string,operationId:string){return path.join(stageRoot(directory),uuid.parse(workspaceId),uuid.parse(operationId));}
function stageFile(folder:string,id:string,variant:Variant){return path.join(folder,`${uuid.parse(id)}-${variant}.webp`);}
function destination(directory:string,itemId:string,mediaId:string,variant:Variant){const paths=privateItemAssetPaths(itemId,mediaId,directory);return variant==="image"?paths.full:variant==="thumbnail"?paths.thumbnail:paths.source;}
function identity(command:CreationCommand):WriteIdentity{return{operationId:command.operationId,kind:"item_create",requestHash:hash(canonicalJSON(command))};}
function inputValues(command:CreationCommand){return photoFirstItemValues({...command.fields,categoryPresentation:command.categoryPresentation},command.photos.length>0);}
function parseCommand(context:InventoryContext,value:unknown){
  const command=creationCommandSchema.parse(value);
  if(command.inventoryId!==uuid.parse(context.workspaceId))throw new CreationStageError("Invalid staging inventory");
  validateItemCreation(inputValues(command),command.rows,command.photos.length>0);
  return command;
}

async function boundedRead(directory:string,file:string,maximum:number){
  await assertPrivatePath(directory,file);const stat=await lstat(file);
  if(!stat.isFile()||stat.size>maximum)throw new CreationStageError("Invalid private staging file");
  const bytes=await readFile(file);if(bytes.length>maximum)throw new CreationStageError("Private staging file changed size");return bytes;
}
async function readManifest(directory:string,folder:string):Promise<Manifest|null>{
  try{
    const manifest=manifestSchema.parse(JSON.parse((await boundedRead(directory,path.join(folder,"manifest.json"),64*1024)).toString("utf8")));
    if(operationFolder(directory,manifest.workspaceId,manifest.operationId)!==folder)throw new CreationStageError("Staging identity mismatch");
    return manifest;
  }catch(error){if(error instanceof Error&&"code"in error&&error.code==="ENOENT")return null;throw error;}
}
async function durableWrite(directory:string,file:string,bytes:Uint8Array|string){
  await assertPrivatePath(directory,file);const handle=await open(file,"wx");
  try{await handle.writeFile(bytes);await handle.sync();}finally{await handle.close();}
}
async function writeManifest(directory:string,folder:string,manifest:Manifest){
  const temp=path.join(folder,`manifest-${randomUUID()}.tmp`);
  try{await durableWrite(directory,temp,JSON.stringify(manifestSchema.parse(manifest)));await rename(temp,path.join(folder,"manifest.json"));}
  finally{await rm(temp,{force:true});}
}
async function removeOperation(directory:string,folder:string){
  await assertPrivatePath(directory,folder);
  for(const entry of await readdir(folder,{withFileTypes:true}))if(!entry.isFile()||entry.isSymbolicLink()||!safeStageFile.test(entry.name))throw new CreationStageError("Unknown staging contents retained");
  const relative=path.relative(stageRoot(directory),folder);
  if(relative.split(path.sep).length!==2||relative.split(path.sep).some(part=>!uuid.safeParse(part).success))throw new CreationStageError("Unsafe stage cleanup");
  await rm(folder,{recursive:true,force:true});
  try{await rmdir(path.dirname(folder));}catch(error){if(!(error instanceof Error&&"code"in error&&["ENOTEMPTY","ENOENT"].includes(String(error.code))))throw error;}
}
async function photoBytes(directory:string,folder:string,photo:StagedPhoto,variant:Variant){
  const bytes=await boundedRead(directory,stageFile(folder,photo.mediaId,variant),CREATION_STAGE_LIMITS.assetBytes),expected=photo.assets[variant];
  if(bytes.length!==expected.size||hash(bytes)!==expected.sha256)throw new CreationStageError("Staged photo checksum mismatch");return bytes;
}
async function removeStagedPhoto(directory:string,folder:string,photo:StagedPhoto){for(const variant of variants){const file=stageFile(folder,photo.mediaId,variant);await assertPrivatePath(directory,file);await rm(file,{force:true});}}
async function referenced(client:Pick<Client,"execute">,mediaId:string){return(await client.execute({sql:"SELECT 1 FROM media_assets WHERE id=?",args:[mediaId]})).rows.length>0;}
async function removeEmptyMediaFolder(directory:string,itemId:string){
  const folder=path.join(directory,"media","items",uuid.parse(itemId));await assertPrivatePath(directory,folder);
  try{await rmdir(folder);}catch(error){if(!(error instanceof Error&&"code"in error&&["ENOTEMPTY","ENOENT"].includes(String(error.code))))throw error;}
}

// A journal contains only generated identities and expected normalized hashes.
async function recoverPromotion(client:Pick<Client,"execute">,directory:string,folder:string,manifest:Manifest){
  let result:WriteResult|null=null,deleted=false;
  try{result=await readWriteReceipt(client,{workspaceId:manifest.workspaceId},{operationId:manifest.operationId,kind:"item_create",requestHash:manifest.requestHash});}
  catch(error){if(error instanceof WriteReceiptDeleted)deleted=true;else throw error;}
  if(result){await removeOperation(directory,folder);return true;}
  for(const photo of manifest.photos){
    if(await referenced(client,photo.mediaId))throw new CreationStageError("Unexpected referenced promotion retained");
    for(const variant of variants){
      const file=destination(directory,manifest.itemId,photo.mediaId,variant);
      let bytes:Buffer;try{bytes=await boundedRead(directory,file,CREATION_STAGE_LIMITS.assetBytes);}catch(error){if(error instanceof Error&&"code"in error&&error.code==="ENOENT")continue;throw error;}
      if(bytes.length!==photo.assets[variant].size||hash(bytes)!==photo.assets[variant].sha256)throw new CreationStageError("Unrecognized promotion retained");
      await rm(file);
    }
  }
  await removeEmptyMediaFolder(directory,manifest.itemId);
  if(deleted){await removeOperation(directory,folder);return true;}
  manifest.promoting=false;manifest.updatedAt=Date.now();await writeManifest(directory,folder,manifest);return false;
}

async function scanStages(client:Pick<Client,"execute">,directory:string){
  const root=stageRoot(directory);await assertPrivatePath(directory,root);await mkdir(root,{recursive:true});
  let bytes=0,operations=0;
  const workspaces=await readdir(root,{withFileTypes:true});if(workspaces.length>CREATION_STAGE_LIMITS.operations+1)throw new CreationStageError("Staging directory budget exceeded","capacity");
  for(const workspace of workspaces){
    if(!workspace.isDirectory()||workspace.isSymbolicLink()||!uuid.safeParse(workspace.name).success)throw new CreationStageError("Unknown staging directory retained");
    const parent=path.join(root,workspace.name),folders=await readdir(parent,{withFileTypes:true});
    if(folders.length>CREATION_STAGE_LIMITS.operations+1)throw new CreationStageError("Staging operation budget exceeded","capacity");
    for(const entry of folders){
      if(!entry.isDirectory()||entry.isSymbolicLink()||!uuid.safeParse(entry.name).success)throw new CreationStageError("Unknown staging operation retained");
      const folder=operationFolder(directory,workspace.name,entry.name);let manifest=await readManifest(directory,folder);
      if(manifest?.promoting&&await recoverPromotion(client,directory,folder,manifest))continue;
      if(manifest?.promoting)manifest=await readManifest(directory,folder);
      const owner=await client.execute({sql:"SELECT 1 FROM workspaces WHERE id=?",args:[workspace.name]});
      const updatedAt=manifest?.updatedAt??(await lstat(folder)).mtimeMs;
      if(!owner.rows.length||Date.now()-updatedAt>CREATION_STAGE_LIMITS.lifetime){await removeOperation(directory,folder);continue;}
      operations++;
      const files=await readdir(folder,{withFileTypes:true});if(files.length>64)throw new CreationStageError("Staging file budget exceeded","capacity");
      for(const file of files){if(!file.isFile()||file.isSymbolicLink()||!safeStageFile.test(file.name))throw new CreationStageError("Unknown staging file retained");bytes+=(await lstat(path.join(folder,file.name))).size;}
    }
    try{await rmdir(parent);}catch(error){if(!(error instanceof Error&&"code"in error&&["ENOTEMPTY","ENOENT"].includes(String(error.code))))throw error;}
  }
  return{bytes,operations};
}

export async function recoverItemCreations(client:Pick<Client,"execute">,directory:string){return withInventoryOperation(directory,()=>scanStages(client,directory));}

async function prepare(directory:string,command:CreationCommand,usage:{bytes:number;operations:number}){
  const folder=operationFolder(directory,command.inventoryId,command.operationId);let manifest=await readManifest(directory,folder);
  if(!manifest){
    if(usage.operations>=CREATION_STAGE_LIMITS.operations)throw new CreationStageError("Staging operation budget exceeded","capacity");
    await assertPrivatePath(directory,folder);await mkdir(folder,{recursive:true});
    manifest={version:1,workspaceId:command.inventoryId,operationId:command.operationId,itemId:randomUUID(),requestHash:identity(command).requestHash,updatedAt:Date.now(),promoting:false,photos:[]};
    await writeManifest(directory,folder,manifest);
  }
  if(manifest.promoting)throw new CreationStageError("Unresolved promotion journal");
  const retained=manifest.photos.filter(photo=>command.photos.some(input=>input.id===photo.input.id));
  const removed=manifest.photos.filter(photo=>!retained.includes(photo));
  manifest={...manifest,requestHash:identity(command).requestHash,updatedAt:Date.now(),photos:retained};
  await writeManifest(directory,folder,manifest);
  for(const photo of removed)await removeStagedPhoto(directory,folder,photo);
  return{folder,manifest};
}
async function verifyUpload(file:File,descriptor:CreationPhoto["selected"]){
  if(!(file instanceof File)||file.size!==descriptor.size||file.size>10*1024*1024||file.type!==descriptor.type||safePhotoName(file.name)!==descriptor.name)throw new CreationStageError("Photo upload descriptor mismatch");
  if(hash(new Uint8Array(await file.arrayBuffer()))!==descriptor.sha256)throw new CreationStageError("Photo upload checksum mismatch");
}

export async function stageItemCreation(context:InventoryContext,value:unknown,photoIdValue:unknown,file:File,source:File=file):Promise<{ready:true}|{completed:WriteResult}>{
  const command=parseCommand(context,value),photoId=uuid.parse(photoIdValue),input=command.photos.find(photo=>photo.id===photoId);
  if(!input)throw new CreationStageError("Photo not in creation command");
  const directory=dataDirectory();
  return withInventoryOperation(directory,async()=>{
    const {db}=await inventoryDatabase(context),receipt=await readWriteReceipt(db.$client,context,identity(command));if(receipt)return{completed:receipt};
    const usage=await scanStages(db.$client,directory);
    const {folder,manifest}=await prepare(directory,command,usage);
    await verifyUpload(file,input.selected);await verifyUpload(source,input.source);
    const previous=manifest.photos.find(photo=>photo.input.id===photoId);
    if(previous&&canonicalJSON(previous.input)===canonicalJSON(input)){
      try{for(const variant of variants)await photoBytes(directory,folder,previous,variant);return{ready:true};}catch{/* Reprocess from the browser's retained inputs. */}
    }
    const image=await normalizeItemPhoto(file,source,input.crop?JSON.stringify(input.crop):"");
    const buffers={image:image.full,thumbnail:image.thumbnail,source:image.source};
    const total=variants.reduce((sum,variant)=>sum+buffers[variant].length,0);
    let live=0;
    for(const entry of await readdir(folder))if(entry.endsWith(".webp"))live+=(await lstat(path.join(folder,entry))).size;
    if(variants.some(variant=>buffers[variant].length>CREATION_STAGE_LIMITS.assetBytes)||live+total>CREATION_STAGE_LIMITS.operationBytes||usage.bytes+total>CREATION_STAGE_LIMITS.totalBytes)throw new CreationStageError("Normalized staging byte budget exceeded","capacity");
    const photo:StagedPhoto={input,mediaId:randomUUID(),width:image.width,height:image.height,cropData:image.cropData,originalFilename:image.originalFilename,assets:{image:{size:0,sha256:""},thumbnail:{size:0,sha256:""},source:{size:0,sha256:""}}};
    const created:string[]=[];
    try{
      for(const variant of variants){const target=stageFile(folder,photo.mediaId,variant);await durableWrite(directory,target,buffers[variant]);created.push(target);photo.assets[variant]={size:buffers[variant].length,sha256:hash(buffers[variant])};}
      manifest.photos=manifest.photos.filter(entry=>entry.input.id!==photoId).concat(photo);manifest.updatedAt=Date.now();await writeManifest(directory,folder,manifest);
    }catch(error){
      const persisted=await readManifest(directory,folder).catch(()=>null);
      if(!persisted?.photos.some(entry=>entry.mediaId===photo.mediaId))for(const target of created)await rm(target,{force:true});
      throw error;
    }
    if(previous)await removeStagedPhoto(directory,folder,previous);
    return{ready:true};
  });
}

export async function finalizeItemCreation(context:InventoryContext,value:unknown):Promise<WriteResult>{
  const command=parseCommand(context,value),write=identity(command),directory=dataDirectory();
  return withInventoryOperation(directory,async()=>{
    const {db}=await inventoryDatabase(context),prior=await readWriteReceipt(db.$client,context,write);if(prior)return prior;
    const usage=await scanStages(db.$client,directory),{folder,manifest}=await prepare(directory,command,usage);
    const photos=command.photos.map(input=>{const photo=manifest.photos.find(entry=>entry.input.id===input.id);if(!photo||canonicalJSON(input)!==canonicalJSON(photo.input))throw new CreationStageError("Photo preparation is incomplete");return photo;});
    for(const photo of photos)for(const variant of variants){await photoBytes(directory,folder,photo,variant);const target=destination(directory,manifest.itemId,photo.mediaId,variant);await assertPrivatePath(directory,target);try{await lstat(target);throw new CreationStageError("Promotion destination already exists");}catch(error){if(!(error instanceof Error&&"code"in error&&error.code==="ENOENT"))throw error;}}
    manifest.promoting=true;await writeManifest(directory,folder,manifest);
    const created:string[]=[];let result:WriteResult;
    try{
      for(const photo of photos)for(const variant of variants){
        const target=destination(directory,manifest.itemId,photo.mediaId,variant);await mkdir(path.dirname(target),{recursive:true});await assertPrivatePath(directory,target);
        const handle=await open(target,"wx");created.push(target);
        try{await handle.writeFile(await photoBytes(directory,folder,photo,variant));await handle.sync();}finally{await handle.close();}
        const bytes=await boundedRead(directory,target,CREATION_STAGE_LIMITS.assetBytes);if(hash(bytes)!==photo.assets[variant].sha256)throw new CreationStageError("Promotion checksum mismatch");
      }
      const item=await createItem(context,inputValues(command),command.rows,photos.length?async(tx,itemId)=>{
        for(const [index,photo]of photos.entries()){
          const paths=privateItemAssetPaths(itemId,photo.mediaId,directory);
          await tx.execute({sql:"INSERT INTO media_assets(id,item_id,storage_path,thumbnail_path,source_storage_path,crop_data,original_filename,mime_type,width,height,created_at,is_primary,display_order) VALUES(?,?,?,?,?,?,?,'image/webp',?,?,?,?,?)",args:[photo.mediaId,itemId,paths.relativeFull,paths.relativeThumbnail,paths.relativeSource,photo.cropData,photo.originalFilename,photo.width,photo.height,new Date().toISOString(),photo.input.id===command.primaryId?1:0,index]});
        }
        if((await tx.execute("PRAGMA foreign_key_check")).rows.length)throw new CreationStageError("Creation relationship check failed");
      }:undefined,{id:manifest.itemId,identity:write});
      result={itemId:item.id,mediaId:null,inventoryNumber:item.inventoryNumber};
    }catch(error){
      // A commit acknowledgement is not proof that the transaction rolled back.
      const committed=await readWriteReceipt(db.$client,context,write);if(committed){await removeOperation(directory,folder);return committed;}
      for(const photo of photos)if(await referenced(db.$client,photo.mediaId))throw new CreationStageError("Ambiguous promotion retained");
      for(const file of created){await assertPrivatePath(directory,file);await rm(file,{force:true});}
      await removeEmptyMediaFolder(directory,manifest.itemId);
      manifest.promoting=false;manifest.updatedAt=Date.now();await writeManifest(directory,folder,manifest);throw error;
    }
    try{await removeOperation(directory,folder);}catch{console.error("Completed item creation staging cleanup remains pending");}
    return result;
  });
}
