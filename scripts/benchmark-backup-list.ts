// Synthetic only: never opens the configured owner installation.
import {mkdtemp,readFile,writeFile} from "node:fs/promises";
import {randomBytes} from "node:crypto";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import {spawn} from "node:child_process";
import {once} from "node:events";

async function main(){
  const existing=process.argv[2];
  const directory=existing?path.resolve(existing):await mkdtemp(path.join(os.tmpdir(),"all-items-list-benchmark-"));
  const relative=path.relative(os.tmpdir(),directory);
  if(relative.startsWith("..")||path.isAbsolute(relative)||!path.basename(directory).startsWith("all-items-list-benchmark-"))throw new Error("Synthetic temporary benchmark directory required");
  process.env.ALL_ITEMS_DATA_DIR=directory;
  const {getDatabase}=await import("../src/db/client");
  const {applyMigrations}=await import("../src/db/migrate");
  const {createBackup,listBackups}=await import("../src/backup/service");
  const {runMaintenance}=await import("../src/auth/authority");
  if(!existing){
    const db=(await getDatabase()).$client;
    try{await applyMigrations(db,path.join(process.cwd(),"src/db/migrations"));
      await runMaintenance(async()=>{
        const {createInventory}=await import("../src/items/inventories");
        const {createItemWithPhoto}=await import("../src/media/service");
        const context=await createInventory("Synthetic listing benchmark");
        const bytes=await sharp(randomBytes(512*512*3),{raw:{width:512,height:512,channels:3}}).png().toBuffer();
        const image=new File([new Uint8Array(bytes)],"synthetic.png",{type:"image/png"});
        for(let i=0;i<8;i++)await createItemWithPhoto(context,{name:"Synthetic "+i},image);
      });
    }finally{db.close();}
    const summaries=[];
    for(let i=0;i<3;i++){const backup=await createBackup(directory);summaries.push({files:backup.manifest.files.length,bytes:backup.bytes});}
    await writeFile(path.join(directory,"benchmark-fixture.json"),JSON.stringify(summaries));
  }
  const start=performance.now(),result=await listBackups(directory);
  const report={directory,backups:result.length,listMs:Math.round((performance.now()-start)*100)/100,fixture:JSON.parse(await readFile(path.join(directory,"benchmark-fixture.json"),"utf8"))};
  if(!process.argv.includes("--page")){console.log(JSON.stringify(report));return;}
  const {provisionAccount,federatedSession,ORIGINAL_OWNER_ID}=await import("../src/auth/core");
  const client=(await getDatabase()).$client;let token:string,inventoryId:string;
  try{
    if(!(await client.execute({sql:"SELECT password_hash FROM auth_users WHERE id=?",args:[ORIGINAL_OWNER_ID]})).rows[0]?.password_hash)await provisionAccount(client,"synthetic-benchmark","Synthetic benchmark password",true);
    inventoryId=String((await client.execute("SELECT id FROM workspaces WHERE name='Synthetic listing benchmark'")).rows[0]!.id);
    await client.execute({sql:"INSERT OR IGNORE INTO inventory_owners(workspace_id,user_id) VALUES(?,?)",args:[inventoryId,ORIGINAL_OWNER_ID]});
    token=(await federatedSession(client,directory,ORIGINAL_OWNER_ID)).token;
  }finally{client.close();}
  const origin="http://127.0.0.1:3118",app=spawn(process.execPath,["node_modules/next/dist/bin/next","start","--hostname","127.0.0.1","--port","3118"],{env:{...process.env,ALL_ITEMS_NEXT_DIST:".next",ALL_ITEMS_ORIGIN:origin,ALL_ITEMS_PROXY_MODE:"",ALL_ITEMS_PROXY_SECRET:"",NODE_ENV:"production"},windowsHide:true,stdio:"ignore"});
  try{
    let ready=false;for(let i=0;i<100;i++){if(app.exitCode!==null)throw new Error("Synthetic benchmark server failed");try{ready=(await fetch(origin+"/login")).status===200;}catch{}if(ready)break;await new Promise(resolve=>setTimeout(resolve,200));}if(!ready)throw new Error("Synthetic server readiness timeout");
    const headers={cookie:`all-items-session=${token}`};
    await(await fetch(origin+"/inventories/"+inventoryId,{headers})).text();
    const timings=[];for(let i=0;i<2;i++){const started=performance.now(),response=await fetch(origin+"/inventories/"+inventoryId+"/data",{headers});const html=await response.text();if(response.status!==200||!html.includes("installation-backups-title"))throw new Error("Synthetic Data page unavailable");timings.push(Math.round((performance.now()-started)*100)/100);}
    console.log(JSON.stringify({...report,dataPageMs:timings}));
  }finally{if(app.exitCode===null){const stopped=once(app,"exit");app.kill();await stopped;}}
}
main().catch(()=>{console.error("Synthetic backup-list benchmark failed");process.exitCode=1;});
