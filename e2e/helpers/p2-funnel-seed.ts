import {readdir,writeFile} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import {getDatabase,dataDirectory} from "../../src/db/client";
import {applyMigrations} from "../../src/db/migrate";
import {provisionAccount} from "../../src/auth/core";
import {runMaintenance} from "../../src/auth/authority";
import {createInventory} from "../../src/items/inventories";
import {createItemWithPhoto,getPrimaryPhoto} from "../../src/media/service";
import {createCollection} from "../../src/items/collections";
import {replaceCollectionCoverUpload} from "../../src/media/collection-covers";
import {syntheticAccounts} from "./auth-credentials";

async function main(){
  const directory=dataDirectory(),relative=path.relative(os.tmpdir(),directory);
  if(relative.startsWith("..")||path.isAbsolute(relative)||!path.basename(directory).startsWith("all-items-p2-funnel-")||(await readdir(directory)).length)throw new Error("New synthetic temporary installation required");
  const client=(await getDatabase()).$client;
  try{
    await applyMigrations(client,path.join(process.cwd(),"src/db/migrations"));
    await provisionAccount(client,syntheticAccounts.owner.username,syntheticAccounts.owner.password,true);
    const fixtures=[];
    for(const who of["alice","bob"] as const){
      const account=syntheticAccounts[who],user=await provisionAccount(client,account.username,account.password);
      fixtures.push(await runMaintenance(async()=>{
        const inventory=await createInventory("Synthetic Funnel "+who);
        await client.execute({sql:"INSERT INTO inventory_owners(workspace_id,user_id) VALUES(?,?)",args:[inventory.workspaceId,user.id]});
        const bytes=await sharp({create:{width:180,height:140,channels:3,background:"#6b7863"}}).png().toBuffer(),image=new File([new Uint8Array(bytes)],"synthetic.png",{type:"image/png"});
        const item=await createItemWithPhoto(inventory,{name:"Synthetic private "+who},image,image);
        const collection=await createCollection(inventory,{name:"Synthetic cover "+who}),cover=await replaceCollectionCoverUpload(inventory,collection.id,image);
        return{who,inventory:inventory.workspaceId,item:item.id,media:(await getPrimaryPhoto(inventory,item.id))!.id,collection:collection.id,cover};
      }));
    }
    await writeFile(path.join(directory,"fixture.json"),JSON.stringify(fixtures));
  }finally{client.close();}
}
main().catch(()=>{console.error("Synthetic Funnel fixture failed");process.exitCode=1;});
