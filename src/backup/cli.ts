import { z } from "zod";
import { dataDirectory } from "@/db/client";
import { createBackup,listBackups,verifyBackup,restoreDrill,retainBackups } from "./service";

async function main(){
  const [command,id,...flags]=process.argv.slice(2),directory=dataDirectory(),start=Date.now();
  if(command==="create"){if([id,...flags].filter(Boolean).some(f=>f!=="--scheduled"))throw new Error("Unknown option");const result=await createBackup(directory,{pinned:id!=="--scheduled"});console.log(JSON.stringify({id:result.manifest.id,path:result.path,bytes:result.bytes,elapsedMs:Date.now()-start,verified:true}));}
  else if(command==="list")console.log(JSON.stringify(await listBackups(directory),null,2));
  else if(command==="verify"){const result=await verifyBackup(directory,z.uuid().parse(id));console.log(JSON.stringify({verified:true,id:result.manifest.id,bytes:result.bytes}));}
  else if(command==="drill")console.log(JSON.stringify(await restoreDrill(directory,z.uuid().parse(id)),null,2));
  else if(command==="retention"){const options=[id,...flags].filter((v):v is string=>Boolean(v));if(options.some(v=>v!=="--apply"&&!/^--(?:daily|weekly)=\d+$/.test(v)))throw new Error("Unknown retention option");const value=(key:string,fallback:number)=>Number(options.find(v=>v.startsWith(key+"="))?.split("=")[1]??fallback);console.log(JSON.stringify(await retainBackups(directory,{daily:value("--daily",14),weekly:value("--weekly",8)},options.includes("--apply"))));}
  else throw new Error("Usage: npm run backup -- create [--scheduled] | list | verify UUID | drill UUID | retention [--apply]");
}
main().catch(error=>{console.error(error instanceof Error?error.message:"Backup operation failed");process.exitCode=1;});
