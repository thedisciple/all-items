import {beforeAll,expect,it,vi} from "vitest";
import {createClient} from "@libsql/client";
import {randomUUID,createHash} from "node:crypto";
import {mkdtemp,readFile,readdir} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {pathToFileURL} from "node:url";
import sharp from "sharp";
import {applyMigrations} from "@/db/migrate";
import {createItem} from "@/items/service";
import {addItemPhoto,listItemPhotos,replaceItemPhoto} from "./service";

const fault=vi.hoisted(()=>({enabled:false,writes:0}));
vi.mock("node:fs/promises",async importOriginal=>{
  const original=await importOriginal<typeof import("node:fs/promises")>();
  const shouldFail=(target:unknown)=>fault.enabled&&String(target).replaceAll("\\","/").includes("/media/items/")&&++fault.writes===2;
  return{...original,writeFile:async(...args:Parameters<typeof original.writeFile>)=>{if(shouldFail(args[0])){fault.enabled=false;await original.writeFile(args[0],Buffer.from("Synthetic partial write"),args[2]);throw new Error("Synthetic disk write failure");}return original.writeFile(...args);},open:async(...args:Parameters<typeof original.open>)=>{
    const handle=await original.open(...args);
    if(shouldFail(args[0])){
      fault.enabled=false;const write=handle.writeFile.bind(handle);
      handle.writeFile=async()=>{await write(Buffer.from("Synthetic partial write"));throw new Error("Synthetic disk write failure");};
    }
    return handle;
  }};
});
let directory:string,client:ReturnType<typeof createClient>;
const context={workspaceId:"00000000-0000-4000-8000-000000000001"};
beforeAll(async()=>{
  directory=await mkdtemp(path.join(os.tmpdir(),"all-items-partial-media-"));process.env.ALL_ITEMS_DATA_DIR=directory;
  client=createClient({url:pathToFileURL(path.join(directory,"all-items.db")).href});await applyMigrations(client,path.join(process.cwd(),"src/db/migrations"));
});
it("removes only owned partial replacement files, preserves the saved source and retries once",async()=>{
  const file=new File([new Uint8Array(await sharp({create:{width:240,height:180,channels:3,background:"#688573"}}).png().toBuffer())],"synthetic-disk.png",{type:"image/png"});
  const item=await createItem(context,{name:"Synthetic partial-write replacement"}),old=await addItemPhoto(context,item.id,file),folder=path.join(directory,"media","items",item.id);
  const digest=async()=>Object.fromEntries(await Promise.all((await readdir(folder)).sort().map(async name=>[name,createHash("sha256").update(await readFile(path.join(folder,name))).digest("hex")])));
  const before=await digest(),operation=randomUUID();fault.enabled=true;fault.writes=0;
  await expect(replaceItemPhoto(context,item.id,old.id,file,file,"",operation)).rejects.toThrow("Synthetic disk write failure");
  expect(await digest()).toEqual(before);expect((await listItemPhotos(context,item.id)).map(photo=>photo.id)).toEqual([old.id]);expect((await client.execute("SELECT COUNT(*) AS count FROM item_write_receipts")).rows[0]!.count).toBe(0);
  const saved=await replaceItemPhoto(context,item.id,old.id,file,file,"",operation),retried=await replaceItemPhoto(context,item.id,old.id,file,file,"",operation);
  expect(retried.id).toBe(saved.id);expect(saved.id).not.toBe(old.id);expect((await listItemPhotos(context,item.id)).map(photo=>photo.id)).toEqual([saved.id]);expect(await readdir(folder)).toHaveLength(3);
});
