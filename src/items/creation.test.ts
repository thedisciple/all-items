import {beforeAll,expect,it,vi} from "vitest";
import {createClient} from "@libsql/client";
import {createHash,randomUUID} from "node:crypto";
import {copyFile,mkdir,mkdtemp,readFile,readdir,rm,writeFile} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {pathToFileURL} from "node:url";
import sharp from "sharp";
import {applyMigrations} from "@/db/migrate";
import {createInventoryArchive,readInventoryArchive} from "@/export/archive";
import {importArchiveAsNew,type PortableInventory} from "@/export/import";
import {listItemPhotos,readItemPhoto,deleteItemWithMedia} from "@/media/service";
import {creationCommandSchema,safePhotoName,type CreationCommand} from "./creation-command";
import {finalizeItemCreation,recoverItemCreations,stageItemCreation} from "./creation";
import {WriteReceiptConflict,WriteReceiptDeleted} from "./write-receipts";

const fault=vi.hoisted(()=>({acknowledgement:false}));
vi.mock("./service",async importOriginal=>{
  const original=await importOriginal<typeof import("./service")>();
  return{...original,createItem:async(...args:Parameters<typeof original.createItem>)=>{const result=await original.createItem(...args);if(fault.acknowledgement){fault.acknowledgement=false;throw new Error("Synthetic lost commit acknowledgement");}return result;}};
});
const context={workspaceId:"00000000-0000-4000-8000-000000000001"};
const foreign={workspaceId:randomUUID()};
let directory:string,client:ReturnType<typeof createClient>;
const hash=(bytes:Uint8Array)=>createHash("sha256").update(bytes).digest("hex");
beforeAll(async()=>{
  directory=await mkdtemp(path.join(os.tmpdir(),"all-items-creation-"));process.env.ALL_ITEMS_DATA_DIR=directory;
  client=createClient({url:pathToFileURL(path.join(directory,"all-items.db")).href});await applyMigrations(client,path.join(process.cwd(),"src/db/migrations"));
  await client.execute({sql:"INSERT INTO workspaces(id,name,created_at) VALUES(?,?,?)",args:[foreign.workspaceId,"Synthetic foreign creation",new Date().toISOString()]});
});
async function fixture(count=3){
  const files:File[]=[];
  for(let index=0;index<count;index++)files.push(new File([new Uint8Array(await sharp({create:{width:320,height:240,channels:3,background:["#61846f","#956c59","#596f95"][index%3]!}}).withMetadata().png().toBuffer())],`synthetic-${index}.png`,{type:"image/png"}));
  const command:CreationCommand={version:1,inventoryId:context.workspaceId,operationId:randomUUID(),fields:{name:"Synthetic atomic creation "+randomUUID(),model:"M4A",brand:"",categories:["electronics","Synthetic custom"],trackingMode:"unique",originalMarking:"",description:"",notes:"Synthetic private note",identificationStatus:"unknown",saleIntent:"not_for_sale",askingPrice:"12.345",askingCurrency:"KWD"},rows:[{location:"",quantity:"1"}],categoryPresentation:[{category:"Synthetic custom",emoji:"🧰"}],photos:[],primaryId:null};
  for(const file of files){const descriptor={sha256:hash(new Uint8Array(await file.arrayBuffer())),size:file.size,name:safePhotoName(file.name),type:"image/png" as const};command.photos.push({id:randomUUID(),selected:descriptor,source:descriptor,crop:null});}
  command.primaryId=command.photos[1]?.id??command.photos[0]?.id??null;
  return{command,files};
}
async function stage(command:CreationCommand,files:File[],sources=files){for(const [index,photo]of command.photos.entries())await stageItemCreation(context,command,photo.id,files[index]!,sources[index]!);}
async function count(name:string){return Number((await client.execute({sql:"SELECT COUNT(*) AS count FROM items WHERE name=?",args:[name]})).rows[0]!.count);}
async function sequence(){return Number((await client.execute({sql:"SELECT next_inventory_number FROM workspaces WHERE id=?",args:[context.workspaceId]})).rows[0]!.next_inventory_number);}
function folder(command:CreationCommand){return path.join(directory,"creation-staging",command.inventoryId,command.operationId);}

it("stages privately, commits one ordered primary gallery and recovers a lost acknowledgement",async()=>{
  const {command,files}=await fixture();const before=await sequence();
  await stage(command,files);expect(await count(command.fields.name)).toBe(0);expect(await sequence()).toBe(before);
  fault.acknowledgement=true;const result=await finalizeItemCreation(context,command);
  expect(await count(command.fields.name)).toBe(1);expect(await sequence()).toBe(before+1);
  const photos=await listItemPhotos(context,result.itemId);expect(photos).toHaveLength(3);expect(photos.map(photo=>photo.isPrimary)).toEqual([false,true,false]);expect(photos.map(photo=>photo.displayOrder)).toEqual([0,1,2]);
  for(const photo of photos)for(const variant of ["image","thumbnail","source"]){const metadata=await sharp((await readItemPhoto(context,result.itemId,photo.id,variant))!).metadata();expect(metadata.format).toBe("webp");for(const key of ["exif","icc","xmp","iptc"] as const)expect(metadata[key]).toBeUndefined();}
  const retries=await Promise.all([finalizeItemCreation(context,command),finalizeItemCreation(context,command)]);expect(retries).toEqual([result,result]);
  expect(await stageItemCreation(context,command,command.photos[0]!.id,new File(["bad"],"bad.png",{type:"image/png"}))).toEqual({completed:result});
  expect(await sequence()).toBe(before+1);await expect(readdir(folder(command))).rejects.toMatchObject({code:"ENOENT"});
  const archive=await createInventoryArchive(context,{client,directory}),record=(readInventoryArchive(archive).inventory as PortableInventory).items.find(item=>item.id===result.itemId)!;
  expect(record.mediaAssets.map(photo=>photo.id)).toEqual(photos.map(photo=>photo.id));expect(record.asking_price_minor).toBe(12345);
  const restored=await importArchiveAsNew(context,archive,"Synthetic multi-create restore",{client,directory});
  const portable=readInventoryArchive(await createInventoryArchive({workspaceId:restored.inventoryId},{client,directory})).inventory as PortableInventory;
  const copy=portable.items.find(item=>item.inventory_number===record.inventory_number)!;expect(copy.mediaAssets.map(photo=>photo.isPrimary)).toEqual([false,true,false]);
  for(const [index,photo]of photos.entries())for(const variant of ["image","thumbnail","source"])expect(hash((await readItemPhoto({workspaceId:restored.inventoryId},copy.id,copy.mediaAssets[index]!.id,variant))!)).toBe(hash((await readItemPhoto(context,result.itemId,photo.id,variant))!));
},60_000);

it("keeps every stage on processing and transactional rejection, without a partial item or number",async()=>{
  const {command,files}=await fixture();const before=await sequence();await stage(command,files);
  await client.execute("CREATE TRIGGER creation_synthetic_failure BEFORE INSERT ON media_assets WHEN NEW.display_order=1 BEGIN SELECT RAISE(ABORT,'synthetic creation failure'); END");
  try{await expect(finalizeItemCreation(context,command)).rejects.toThrow("synthetic creation failure");}finally{await client.execute("DROP TRIGGER creation_synthetic_failure");}
  expect(await count(command.fields.name)).toBe(0);expect(await sequence()).toBe(before);expect((await readdir(folder(command))).filter(file=>file.endsWith(".webp"))).toHaveLength(9);
  const manifest=JSON.parse(await readFile(path.join(folder(command),"manifest.json"),"utf8"));await expect(readdir(path.join(directory,"media/items",manifest.itemId))).rejects.toMatchObject({code:"ENOENT"});
  const result=await finalizeItemCreation(context,command);expect(await count(command.fields.name)).toBe(1);expect((await listItemPhotos(context,result.itemId))).toHaveLength(3);
  const broken=await fixture(2);await stageItemCreation(context,broken.command,broken.command.photos[0]!.id,broken.files[0]!);
  const bad=new File(["invalid image"],"broken.png",{type:"image/png"});const descriptor={sha256:hash(new Uint8Array(await bad.arrayBuffer())),size:bad.size,name:bad.name,type:"image/png" as const};broken.command.photos[1]!.selected=descriptor;broken.command.photos[1]!.source=descriptor;
  await expect(stageItemCreation(context,broken.command,broken.command.photos[1]!.id,bad)).rejects.toThrow();await expect(finalizeItemCreation(context,broken.command)).rejects.toThrow("incomplete");expect(await count(broken.command.fields.name)).toBe(0);
},60_000);

it("rejects foreign preparations and retains completed/deleted operation identities",async()=>{
  const {command,files}=await fixture(1);await stage(command,files);await expect(finalizeItemCreation(foreign,command)).rejects.toThrow("inventory");
  await expect(finalizeItemCreation(foreign,{...command,inventoryId:foreign.workspaceId})).rejects.toThrow("incomplete");
  const result=await finalizeItemCreation(context,command);await expect(finalizeItemCreation(context,{...command,fields:{...command.fields,model:"Changed after acknowledgement"}})).rejects.toBeInstanceOf(WriteReceiptConflict);
  await deleteItemWithMedia(context,result.itemId);await expect(finalizeItemCreation(context,command)).rejects.toBeInstanceOf(WriteReceiptDeleted);expect(await count(command.fields.name)).toBe(0);
});

it("preserves exclusive destination collisions and recovers journaled precommit interruption",async()=>{
  const {command,files}=await fixture(1);await stage(command,files);const manifestPath=path.join(folder(command),"manifest.json"),manifest=JSON.parse(await readFile(manifestPath,"utf8"));
  const output=path.join(directory,"media/items",manifest.itemId);await mkdir(output,{recursive:true});const collision=path.join(output,manifest.photos[0].mediaId+".webp");await writeFile(collision,"Synthetic pre-existing collision",{flag:"wx"});
  await expect(finalizeItemCreation(context,command)).rejects.toThrow("already exists");expect(await readFile(collision,"utf8")).toBe("Synthetic pre-existing collision");await rm(collision);
  manifest.promoting=true;await writeFile(manifestPath,JSON.stringify(manifest));
  for(const [variant,suffix]of [["image",".webp"],["thumbnail","-thumb.webp"],["source","-source.webp"]])await copyFile(path.join(folder(command),manifest.photos[0].mediaId+"-"+variant+".webp"),path.join(output,manifest.photos[0].mediaId+suffix));
  await recoverItemCreations(client,directory);await expect(readdir(output)).rejects.toMatchObject({code:"ENOENT"});expect(await count(command.fields.name)).toBe(0);
  const result=await finalizeItemCreation(context,command);expect((await listItemPhotos(context,result.itemId))).toHaveLength(1);expect((await client.execute("PRAGMA foreign_key_check")).rows).toHaveLength(0);
});

it("rejects eleven-photo and aggregate input commands before staging",async()=>{
  const {command}=await fixture(1);const photo=command.photos[0]!;
  expect(creationCommandSchema.safeParse({...command,photos:Array.from({length:11},()=>({...photo,id:randomUUID()}))}).success).toBe(false);
  const large=Array.from({length:7},(_,index)=>({...photo,id:index===0?photo.id:randomUUID(),selected:{...photo.selected,sha256:index.toString(16).padStart(64,"0"),size:10*1024*1024},source:{...photo.source,sha256:index.toString(16).padStart(64,"0"),size:10*1024*1024}}));
  expect(creationCommandSchema.safeParse({...command,photos:large,primaryId:photo.id}).success).toBe(false);
});

it("retains distinct crops and sources through a draft reorder without changing the primary identity",async()=>{
  const {command,files}=await fixture();const sources=[...files];
  const crops=[{x:5,y:5,width:100,height:80},{x:40,y:30,width:140,height:110},{x:80,y:40,width:180,height:140}];
  for(const [index,crop]of crops.entries()){
    const bytes=await sharp(new Uint8Array(await sources[index]!.arrayBuffer())).extract({left:crop.x,top:crop.y,width:crop.width,height:crop.height}).webp().toBuffer();
    files[index]=new File([new Uint8Array(bytes)],`synthetic-crop-${index}.webp`,{type:"image/webp"});
    command.photos[index]!.selected={sha256:hash(bytes),size:bytes.length,name:files[index]!.name,type:"image/webp"};
    command.photos[index]!.crop={...crop,rotate:0,scaleX:1,scaleY:1};
  }
  await stage(command,files,sources);const original=[...command.photos];command.photos=[original[2]!,original[0]!,original[1]!];
  const result=await finalizeItemCreation(context,command),photos=await listItemPhotos(context,result.itemId);
  expect(photos.map(photo=>photo.width)).toEqual([180,100,140]);expect(photos.map(photo=>photo.isPrimary)).toEqual([false,false,true]);
  expect(photos.map(photo=>photo.crop)).toEqual([command.photos[0]!.crop,command.photos[1]!.crop,command.photos[2]!.crop]);
  for(const photo of photos){const source=await sharp((await readItemPhoto(context,result.itemId,photo.id,"source"))!).metadata();expect([source.width,source.height]).toEqual([320,240]);}
});

it("keeps named creation without photos and language-neutral photo-only creation",async()=>{
  const named=await fixture(0),result=await finalizeItemCreation(context,named.command);expect(await listItemPhotos(context,result.itemId)).toHaveLength(0);
  const unnamed=await fixture(1);unnamed.command.fields.name="";unnamed.command.fields.identificationStatus="source_verified";await stage(unnamed.command,unnamed.files);
  const item=await finalizeItemCreation(context,unnamed.command);
  const row=(await client.execute({sql:"SELECT name,identification_status FROM items WHERE id=?",args:[item.itemId]})).rows[0]!;
  expect([row.name,row.identification_status]).toEqual(["","unknown"]);
});
