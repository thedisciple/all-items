import {createClient} from "@libsql/client";
import {open} from "node:fs/promises";
import path from "node:path";
import {pathToFileURL} from "node:url";
import {inspectDatabase} from "./service";

async function main(){
  const [mode,root,target]=process.argv.slice(2);if(!root||!['snapshot','inspect','read'].includes(mode??''))throw new Error("Invalid backup worker");
  if(mode==="read"){process.env.ALL_ITEMS_DATA_DIR=root;const {listInventories}=await import("@/items/inventories");const {listItems,getItem}=await import("@/items/service");const {listCollections}=await import("@/items/collections");const {listItemPhotos}=await import("@/media/service");const {getDatabase}=await import("@/db/client");try{for(const inventory of await listInventories()){await listCollections(inventory);for(const item of await listItems(inventory)){if(!await getItem(inventory,String(item.id)))throw new Error("Unreadable restored item");await listItemPhotos(inventory,String(item.id));}}console.log("{}");}finally{(await getDatabase()).$client.close();}return;}
  const client=createClient({url:pathToFileURL(path.join(root,"all-items.db")).href,intMode:"number"});
  try{if(mode==="snapshot"){if(!target)throw new Error("Missing snapshot destination");await client.execute("PRAGMA synchronous=FULL");await client.execute({sql:"VACUUM INTO ?",args:[path.join(target,"all-items.db")]});const h=await open(path.join(target,"all-items.db"),"r+");try{await h.sync();}finally{await h.close();}console.log("{}");}else console.log(JSON.stringify(await inspectDatabase(client)));}
  finally{client.close();}
}
main().catch(()=>{console.error("Backup database worker failed integrity or compatibility checks");process.exitCode=1;});
