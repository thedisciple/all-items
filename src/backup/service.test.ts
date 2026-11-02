import {beforeAll,afterAll,it,expect} from "vitest";
import {mkdtemp,readFile,writeFile,rm,mkdir,readdir,symlink} from "node:fs/promises";
import {createHash,randomBytes} from "node:crypto";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import {getDatabase} from "@/db/client";
import {applyMigrations} from "@/db/migrate";
import {createInventory} from "@/items/inventories";
import {createItemWithPhoto,addItemPhoto,setItemPrimaryPhoto,removeItemPhoto} from "@/media/service";
import {createCollection,addItemToCollection,setCollectionCover} from "@/items/collections";
import {replaceCollectionCoverUpload} from "@/media/collection-covers";
import {createBackup,verifyBackup,listBackups,restoreDrill,retainBackups} from "./service";

let directory:string,context:{workspaceId:string},item:string,photo:string,image:File;
beforeAll(async()=>{
  directory=await mkdtemp(path.join(os.tmpdir(),"all-items-backup-test-"));process.env.ALL_ITEMS_DATA_DIR=directory;
  const db=(await getDatabase()).$client;await applyMigrations(db,path.join(process.cwd(),"src/db/migrations"));await db.execute("PRAGMA journal_mode=WAL");
  image=new File([new Uint8Array(await sharp({create:{width:160,height:120,channels:3,background:"#528572"}}).webp().toBuffer())],"synthetic.webp",{type:"image/webp"});
  for(const name of ["Synthetic home","Synthetic workshop"]){context=await createInventory(name);const result=await createItemWithPhoto(context,{name:"Synthetic camera",categories:["tools","Synthetic custom"],trackingMode:"bulk",askingPrice:"12.34",askingCurrency:"EUR"},image,image,"",[{location:"Synthetic shelf",quantity:3}]);item=result.id;
    photo=(await addItemPhoto(context,item,image)).id;await setItemPrimaryPhoto(context,item,photo);const collection=await createCollection(context,{name:"Synthetic collection",icon:"📷"});await addItemToCollection(context,collection.id,item);await setCollectionCover(context,collection.id,{type:"item_photo",itemId:item,mediaId:photo});}
  const upload=await createCollection(context,{name:"Synthetic uploaded cover"});await replaceCollectionCoverUpload(context,upload.id,image);
},90_000);
afterAll(async()=>{await (await getDatabase()).$client.close();});
it("backs up WAL, every inventory, ordered media, sources and relationships; actually restores twice",async()=>{
  const start=Date.now(),backup=await createBackup(directory);expect(backup.manifest.files.filter(f=>f.path.includes("-source"))).toHaveLength(4);
  const first=await restoreDrill(directory,backup.manifest.id),second=await restoreDrill(directory,backup.manifest.id);expect(first.location).not.toBe(second.location);expect(first.semanticHash).toBe(backup.manifest.semanticHash);expect((await verifyBackup(directory,backup.manifest.id)).bytes).toBe(backup.bytes);
  console.log(JSON.stringify({fixture:"small",files:first.files,bytes:first.bytes,backupAndTwoDrillsMs:Date.now()-start}));
},90_000);
it.each(["snapshot","copy","manifest","complete"] as const)("never lists interrupted backup at %s as complete",async fault=>{const before=(await listBackups(directory)).length;await expect(createBackup(directory,{fault})).rejects.toThrow();expect(await listBackups(directory)).toHaveLength(before);});
it("rejects corrupt, missing, unexpected, incomplete and incompatible evidence",async()=>{
  for(const mode of ["media","missing","db","extra","manifest","version","marker"]){const backup=await createBackup(directory),root=backup.path,media=backup.manifest.files.find(f=>f.path.startsWith("media/"))!.path;
    if(mode==="media"||mode==="db")await writeFile(path.join(root,mode==="db"?"all-items.db":media),"corrupt");
    if(mode==="missing")await rm(path.join(root,media));if(mode==="extra")await writeFile(path.join(root,"secret.txt"),"unexpected");
    if(mode==="manifest")await writeFile(path.join(root,"manifest.json"),"{}");if(mode==="version")await writeFile(path.join(root,"manifest.json"),JSON.stringify({...backup.manifest,version:99}));if(mode==="marker")await rm(path.join(root,"COMPLETE"));
    await expect(verifyBackup(directory,backup.manifest.id)).rejects.toThrow();}
},90_000);
it("does not touch live media during interrupted drill or concurrent media removal",async()=>{
  const backup=await createBackup(directory),before=await readFile(path.join(directory,backup.manifest.files.find(f=>f.path.startsWith("media/"))!.path));await expect(restoreDrill(directory,backup.manifest.id,"copy")).rejects.toThrow("isolated evidence");
  expect(await readFile(path.join(directory,backup.manifest.files.find(f=>f.path.startsWith("media/"))!.path))).toEqual(before);
  await expect(createBackup(directory,{afterSnapshot:()=>removeItemPhoto(context,item,photo).then(()=>{})})).rejects.toThrow();await verifyBackup(directory,backup.manifest.id);
});
it("retention is a dry run by default and protects pinned, migration and partial folders",async()=>{
  await mkdir(path.join(directory,"backups","before-migration-synthetic"));await writeFile(path.join(directory,"backups","before-migration-synthetic","sentinel"),"protected");
  const pinned=await createBackup(directory);await createBackup(directory,{pinned:false});await createBackup(directory,{pinned:false});const result=await retainBackups(directory,{daily:1,weekly:1});expect(result.remove).not.toContain(pinned.manifest.id);expect(result.remove.length).toBeGreaterThan(0);
  await retainBackups(directory,{daily:1,weekly:1},true);await verifyBackup(directory,pinned.manifest.id);expect(await readFile(path.join(directory,"backups","before-migration-synthetic","sentinel"),"utf8")).toBe("protected");expect((await readdir(path.join(directory,"backups"))).some(n=>n.startsWith(".partial-"))).toBe(true);
});
it("rejects path traversal, foreign identifiers and symbolic backup entries",async()=>{
  for(const unsafe of ["../outside","C:\\outside","media/items/../../outside"]){const backup=await createBackup(directory);const manifest={...backup.manifest,files:[{...backup.manifest.files[0]!,path:unsafe}]};const text=JSON.stringify(manifest);await writeFile(path.join(backup.path,"manifest.json"),text);await writeFile(path.join(backup.path,"COMPLETE"),createHash("sha256").update(text).digest("hex"));await expect(verifyBackup(directory,backup.manifest.id)).rejects.toThrow();}
  const backup=await createBackup(directory),outside=await mkdtemp(path.join(os.tmpdir(),"all-items-backup-link-"));await symlink(outside,path.join(backup.path,"unexpected-link"),process.platform==="win32"?"junction":"dir");await expect(verifyBackup(directory,backup.manifest.id)).rejects.toThrow();
},60_000);
it("measures a moderate synthetic installation with streamed media copies",async()=>{
  const bytes=await sharp(randomBytes(256*256*3),{raw:{width:256,height:256,channels:3}}).png().toBuffer(),file=new File([new Uint8Array(bytes)],"synthetic-noise.png",{type:"image/png"});
  for(let i=0;i<24;i++)await createItemWithPhoto(context,{name:"Synthetic benchmark "+i},file);
  const start=Date.now(),backup=await createBackup(directory),backupMs=Date.now()-start,report=await restoreDrill(directory,backup.manifest.id);expect(report.files).toBeGreaterThan(70);console.log(JSON.stringify({fixture:"moderate",files:report.files,bytes:report.bytes,backupMs,restoreMs:report.elapsedMs,semanticHash:report.semanticHash}));
},120_000);
