import { writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { getDatabase, dataDirectory } from "../../src/db/client";
import { createInventory } from "../../src/items/inventories";
import { createItemWithPhoto, getPrimaryPhoto } from "../../src/media/service";
import { createCollection, addItemsToCollection } from "../../src/items/collections";
import { replaceCollectionCoverUpload } from "../../src/media/collection-covers";
import {runMaintenance} from "../../src/auth/authority";
import {ORIGINAL_OWNER_ID,provisionAccount} from "../../src/auth/core";
import {syntheticAccounts} from "./auth-credentials";

async function main() {
  for(const key of["owner","alice"] as const)await provisionAccount((await getDatabase()).$client,syntheticAccounts[key].username,syntheticAccounts[key].password,key==="owner");
  await runMaintenance(async()=>{
  const inventories=[];
  const bytes=await sharp({create:{width:240,height:360,channels:3,background:"#6a7560"}}).png().toBuffer();
  const file=new File([new Uint8Array(bytes)],"synthetic.png",{type:"image/png"});
  for(const name of ["Restart Home","Restart Workshop"]) {
    const inventory=await createInventory(name);
    await(await getDatabase()).$client.execute({sql:"INSERT INTO inventory_owners(workspace_id,user_id) VALUES(?,?)",args:[inventory.workspaceId,ORIGINAL_OWNER_ID]});
    const item=await createItemWithPhoto(inventory,{name:`${name} item`,trackingMode:"bulk",categories:["tools"]},file,file,"",[{location:`${name} shelf`,quantity:3}]);
    const collection=await createCollection(inventory,{name:`${name} collection`});
    await addItemsToCollection(inventory,collection.id,[item.id]);
    const cover=await replaceCollectionCoverUpload(inventory,collection.id,file);
    const media=(await getPrimaryPhoto(inventory,item.id))!.id;
    inventories.push({id:inventory.workspaceId,name,item:item.id,collection:collection.id,cover,media});
  }
  await writeFile(path.join(dataDirectory(),"fixture.json"),JSON.stringify(inventories));
  });
  await (await getDatabase()).$client.close();
}
void main().catch(error=>{console.error(error);process.exitCode=1;});
