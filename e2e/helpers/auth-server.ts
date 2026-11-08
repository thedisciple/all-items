import {mkdir,readdir} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {spawn} from "node:child_process";
import {getDatabase,dataDirectory} from "../../src/db/client";
import {applyMigrations} from "../../src/db/migrate";
import {provisionAccount} from "../../src/auth/core";
import {syntheticAccounts} from "./auth-credentials";

// This is test provisioning, not an application mode or authentication bypass.
async function main(){
const directory=dataDirectory(),relative=path.relative(os.tmpdir(),directory);
if(relative.startsWith("..")||path.isAbsolute(relative)||!path.basename(directory).startsWith("all-items-"))throw new Error("Synthetic server requires a new OS temporary directory");
await mkdir(directory,{recursive:true});if((await readdir(directory)).length)throw new Error("Refusing to provision an existing installation");
const client=(await getDatabase()).$client;try{await applyMigrations(client,path.join(process.cwd(),"src/db/migrations"));for(const [key,account]of Object.entries(syntheticAccounts))await provisionAccount(client,account.username,account.password,key==="owner");}finally{client.close();}
const app=spawn(process.execPath,["node_modules/next/dist/bin/next",process.env.ALL_ITEMS_E2E_SERVER==="production"?"start":"dev","--hostname","127.0.0.1","--port","3100"],{env:process.env,windowsHide:true,stdio:"inherit"});
for(const signal of["SIGINT","SIGTERM"] as const)process.on(signal,()=>app.kill());app.on("exit",code=>{process.exitCode=code??1;});
}
main().catch(()=>{console.error("Synthetic authenticated fixture failed");process.exitCode=1;});
