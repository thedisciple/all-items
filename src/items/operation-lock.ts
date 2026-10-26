import { mkdir, open, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { assertPrivatePath } from "@/media/private-paths";

export class InventoryBusyError extends Error { constructor() { super("Another inventory operation is running"); } }
const lockSchema=z.object({pid:z.number().int().positive(),token:z.uuid()});

export async function withInventoryOperation<T>(directory:string,operation:()=>Promise<T>):Promise<T> {
  await mkdir(directory,{recursive:true});
  const lock=path.join(directory,"inventory-operation.lock");
  const token=randomUUID();
  const deadline=Date.now()+30_000;
  while(true) {
    await assertPrivatePath(directory,lock);
    try {
      const file=await open(lock,"wx");
      try { await file.writeFile(JSON.stringify({pid:process.pid,token})); await file.sync(); } finally { await file.close(); }
      break;
    } catch(error) {
      if(!(error instanceof Error && "code" in error && error.code==="EEXIST")) throw error;
      try {
        const owner=lockSchema.parse(JSON.parse(await readFile(lock,"utf8")));
        let active=true;
        try { process.kill(owner.pid,0); } catch(cause) { if(cause instanceof Error && "code" in cause && cause.code==="ESRCH") active=false; }
        if(!active) { const current=lockSchema.parse(JSON.parse(await readFile(lock,"utf8"))); if(current.token===owner.token) await rm(lock); continue; }
      } catch(cause) { if(cause instanceof Error && "code" in cause && cause.code==="ENOENT") continue; }
      if(Date.now()>=deadline) throw new InventoryBusyError();
      await new Promise(resolve=>setTimeout(resolve,50));
    }
  }
  try { return await operation(); }
  finally { try { if(lockSchema.parse(JSON.parse(await readFile(lock,"utf8"))).token===token) await rm(lock); } catch { console.error("Inventory operation lock cleanup failed"); } }
}
