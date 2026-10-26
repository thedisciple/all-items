import { expect,it } from "vitest";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { access,mkdtemp,writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { withInventoryOperation } from "./operation-lock";

it("recovers the operation lock left by a terminated process",async()=>{
  const directory=await mkdtemp(path.join(os.tmpdir(),"all-items-lock-"));
  const child=spawn(process.execPath,["-e","process.exit(0)"],{windowsHide:true,stdio:"ignore"});
  const pid=child.pid!;
  await new Promise<void>((resolve,reject)=>{child.once("error",reject);child.once("exit",()=>resolve());});
  const lock=path.join(directory,"inventory-operation.lock");
  await writeFile(lock,JSON.stringify({pid,token:randomUUID()}));
  expect(await withInventoryOperation(directory,async()=>"recovered")).toBe("recovered");
  await expect(access(lock)).rejects.toThrow();
});
