import {beforeAll,beforeEach,expect,it} from "vitest";
import {createClient} from "@libsql/client";
import {randomUUID,createHash} from "node:crypto";
import {mkdtemp,mkdir,open,readFile,readdir,rm,writeFile} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {pathToFileURL} from "node:url";
import sharp from "sharp";
import {applyMigrations} from "@/db/migrate";
import {assertPrivatePath} from "@/media/private-paths";
import {CREATION_STAGE_LIMITS,finalizeItemCreation,recoverItemCreations,stageItemCreation} from "./creation";
import type {CreationCommand} from "./creation-command";

const context={workspaceId:"00000000-0000-4000-8000-000000000001"};let directory:string,client:ReturnType<typeof createClient>,file:File;
const folder=(id:string)=>path.join(directory,"creation-staging",context.workspaceId,id);
beforeAll(async()=>{
  directory=await mkdtemp(path.join(os.tmpdir(),"all-items-creation-resources-"));process.env.ALL_ITEMS_DATA_DIR=directory;
  client=createClient({url:pathToFileURL(path.join(directory,"all-items.db")).href});await applyMigrations(client,path.join(process.cwd(),"src/db/migrations"));
  file=new File([new Uint8Array(await sharp({create:{width:200,height:150,channels:3,background:"#678573"}}).png().toBuffer())],"synthetic-resource.png",{type:"image/png"});
});
beforeEach(async()=>{const root=path.join(directory,"creation-staging");if(path.dirname(path.resolve(directory))!==path.resolve(os.tmpdir())||!path.basename(directory).startsWith("all-items-creation-resources-"))throw new Error("Unexpected synthetic resource directory");await assertPrivatePath(directory,root);await rm(root,{recursive:true,force:true});});
async function command():Promise<CreationCommand>{
  const descriptor={sha256:createHash("sha256").update(new Uint8Array(await file.arrayBuffer())).digest("hex"),name:file.name,size:file.size,type:"image/png" as const},id=randomUUID();
  return{version:1,inventoryId:context.workspaceId,operationId:randomUUID(),fields:{name:"Synthetic resource bounds "+randomUUID(),model:"",brand:"",categories:[],trackingMode:"unique",originalMarking:"",description:"",notes:"",identificationStatus:"unknown",saleIntent:"not_for_sale",askingPrice:"",askingCurrency:""},rows:[{location:"",quantity:"1"}],categoryPresentation:[],photos:[{id,selected:descriptor,source:descriptor,crop:null}],primaryId:id};
}
async function emptyPreparation(id:string=randomUUID()){
  const target=folder(id);await mkdir(target,{recursive:true});await writeFile(path.join(target,"manifest.json"),JSON.stringify({version:1,workspaceId:context.workspaceId,operationId:id,itemId:randomUUID(),requestHash:"a".repeat(64),updatedAt:Date.now(),promoting:false,photos:[]}));return target;
}
async function sparse(target:string,count:number){for(let index=0;index<count;index++){const handle=await open(path.join(target,randomUUID()+"-image.webp"),"wx");try{await handle.truncate(CREATION_STAGE_LIMITS.assetBytes);}finally{await handle.close();}}}

it("bounds the number of tiny preparations independently from their byte usage",async()=>{
  for(let index=0;index<CREATION_STAGE_LIMITS.operations;index++)await emptyPreparation();
  const value=await command();await expect(stageItemCreation(context,value,value.photos[0]!.id,file)).rejects.toMatchObject({code:"capacity"});
  expect((await client.execute({sql:"SELECT COUNT(*) AS count FROM items WHERE name=?",args:[value.fields.name]})).rows[0]!.count).toBe(0);
});
it("counts actual orphaned cache files toward the per-operation budget",async()=>{
  const value=await command();await sparse(await emptyPreparation(value.operationId),2);
  await expect(stageItemCreation(context,value,value.photos[0]!.id,file)).rejects.toMatchObject({code:"capacity"});
});
it("bounds total private staging across several inventories or operations",async()=>{
  for(let index=0;index<4;index++)await sparse(await emptyPreparation(),2);
  const value=await command();await expect(stageItemCreation(context,value,value.photos[0]!.id,file)).rejects.toMatchObject({code:"capacity"});
});
it("expires abandoned preparations and safely prepares the retained browser inputs again",async()=>{
  const value=await command();await stageItemCreation(context,value,value.photos[0]!.id,file);const manifestPath=path.join(folder(value.operationId),"manifest.json"),manifest=JSON.parse(await readFile(manifestPath,"utf8"));
  manifest.updatedAt=Date.now()-CREATION_STAGE_LIMITS.lifetime-1;await writeFile(manifestPath,JSON.stringify(manifest));await recoverItemCreations(client,directory);await expect(readdir(folder(value.operationId))).rejects.toMatchObject({code:"ENOENT"});
  await stageItemCreation(context,value,value.photos[0]!.id,file);const prepared=JSON.parse(await readFile(manifestPath,"utf8"));expect(prepared.itemId).not.toBe(manifest.itemId);const result=await finalizeItemCreation(context,value);expect(result.itemId).toBe(prepared.itemId);
});
it("rejects corrupted prepared bytes without a partial item and reprocesses from retained inputs",async()=>{
  const value=await command();await stageItemCreation(context,value,value.photos[0]!.id,file);const manifest=JSON.parse(await readFile(path.join(folder(value.operationId),"manifest.json"),"utf8"));
  await writeFile(path.join(folder(value.operationId),manifest.photos[0].mediaId+"-image.webp"),"Synthetic corruption");await expect(finalizeItemCreation(context,value)).rejects.toThrow("checksum");
  expect((await client.execute({sql:"SELECT id FROM items WHERE name=?",args:[value.fields.name]})).rows).toHaveLength(0);
  await stageItemCreation(context,value,value.photos[0]!.id,file);const result=await finalizeItemCreation(context,value);expect(result.itemId).toBe(manifest.itemId);
});
