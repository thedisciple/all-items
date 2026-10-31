import {beforeAll,expect,it} from "vitest";
import {createClient} from "@libsql/client";
import {randomUUID} from "node:crypto";
import {mkdtemp,readdir} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {pathToFileURL} from "node:url";
import sharp from "sharp";
import {applyMigrations} from "@/db/migrate";
import {createItem} from "@/items/service";
import {WriteReceiptConflict,WriteReceiptDeleted} from "@/items/write-receipts";
import {addItemPhoto,listItemPhotos,MediaProcessingBusy,replaceItemPhoto} from "./service";

const context={workspaceId:"00000000-0000-4000-8000-000000000001"};let directory:string;
beforeAll(async()=>{
  directory=await mkdtemp(path.join(os.tmpdir(),"all-items-media-retry-"));process.env.ALL_ITEMS_DATA_DIR=directory;
  const client=createClient({url:pathToFileURL(path.join(directory,"all-items.db")).href});try{await applyMigrations(client,path.join(process.cwd(),"src/db/migrations"));}finally{client.close();}
});
async function image(color="#668877",width=320,height=240){return new File([new Uint8Array(await sharp({create:{width,height,channels:3,background:color}}).png().toBuffer())],"synthetic-retry.png",{type:"image/png"});}

it("coalesces concurrent add retries into one photo and cleans redundant normalized files",async()=>{
  const item=await createItem(context,{name:"Synthetic add receipt"}),file=await image(),operationId=randomUUID();
  const results=await Promise.all([0,1,2].map(()=>addItemPhoto(context,item.id,file,file,"",operationId)));
  expect(new Set(results.map(result=>result.id)).size).toBe(1);expect(await listItemPhotos(context,item.id)).toHaveLength(1);
  expect(await readdir(path.join(directory,"media/items",item.id))).toHaveLength(3);
  await expect(addItemPhoto(context,item.id,await image("#997755"),undefined,"",operationId)).rejects.toBeInstanceOf(WriteReceiptConflict);
});

it("acknowledges the tenth photo before applying the cap and retries replacement of the old UUID safely",async()=>{
  const item=await createItem(context,{name:"Synthetic cap acknowledgement"}),file=await image();
  for(let index=0;index<9;index++)await addItemPhoto(context,item.id,file);
  const operationId=randomUUID(),last=await addItemPhoto(context,item.id,file,file,"",operationId);
  expect((await addItemPhoto(context,item.id,file,file,"",operationId)).id).toBe(last.id);expect(await listItemPhotos(context,item.id)).toHaveLength(10);
  const replacementId=randomUUID(),replacement=await replaceItemPhoto(context,item.id,last.id,file,file,"",replacementId);
  expect((await replaceItemPhoto(context,item.id,last.id,file,file,"",replacementId)).id).toBe(replacement.id);
  expect(await listItemPhotos(context,item.id)).toHaveLength(10);
  await expect(addItemPhoto(context,item.id,file,file,"",operationId)).rejects.toBeInstanceOf(WriteReceiptDeleted);
  expect(await readdir(path.join(directory,"media/items",item.id))).toHaveLength(30);
},60_000);

it("bounds queued normalization requests and permits retry after temporary processing pressure",async()=>{
  const item=await createItem(context,{name:"Synthetic bounded processing"}),file=await image("#657a6e",4000,3000),ids=Array.from({length:5},()=>randomUUID());
  const results=await Promise.allSettled(ids.map(id=>addItemPhoto(context,item.id,file,file,"",id)));
  const rejected=results.filter(result=>result.status==="rejected");expect(rejected).toHaveLength(1);
  expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(MediaProcessingBusy);expect(await listItemPhotos(context,item.id)).toHaveLength(4);
  const index=results.findIndex(result=>result.status==="rejected");await addItemPhoto(context,item.id,file,file,"",ids[index]);expect(await listItemPhotos(context,item.id)).toHaveLength(5);
},60_000);
