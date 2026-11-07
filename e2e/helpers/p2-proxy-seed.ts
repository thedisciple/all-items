import {readdir} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {getDatabase,dataDirectory} from "../../src/db/client";
import {applyMigrations} from "../../src/db/migrate";
import {provisionAccount} from "../../src/auth/core";
import {syntheticAccounts} from "./auth-credentials";

async function main(){
  const directory=dataDirectory(),relative=path.relative(os.tmpdir(),directory);
  if(relative.startsWith("..")||path.isAbsolute(relative)||!path.basename(directory).startsWith("all-items-p2-proxy-")||(await readdir(directory)).length)throw new Error("Proxy test requires a new OS temporary directory");
  const client=(await getDatabase()).$client;
  try{await applyMigrations(client,path.join(process.cwd(),"src/db/migrations"));await provisionAccount(client,syntheticAccounts.owner.username,syntheticAccounts.owner.password,true);}finally{client.close();}
}
main().catch(()=>{console.error("Synthetic proxy seed failed");process.exitCode=1;});
