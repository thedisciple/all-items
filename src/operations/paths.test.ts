import {it,expect} from "vitest";
import {mkdtemp,writeFile,mkdir,symlink} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {withReleaseLock,assertSynthetic} from "./paths";

it('serializes release operations without stealing or auto-expiring an existing lock',async()=>{
  const root=await mkdtemp(path.join(os.tmpdir(),'all-items-release-lock-'));await withReleaseLock(root,async()=>{await expect(withReleaseLock(root,async()=>{})).rejects.toThrow();});await expect(withReleaseLock(root,async()=>true)).resolves.toBe(true);
});
it('refuses linked paths rather than letting a marker redirect work to another installation',async()=>{
  const root=await mkdtemp(path.join(os.tmpdir(),'all-items-linked-preview-')),target=path.join(root,'target'),alias=path.join(root,'alias'),id=crypto.randomUUID();await mkdir(target);await writeFile(path.join(target,'synthetic-installation.json'),JSON.stringify({format:'all-items-synthetic',installationId:id}));await symlink(target,alias,process.platform==='win32'?'junction':'dir');await expect(assertSynthetic(alias,id,path.join(root,'personal'),process.cwd())).rejects.toThrow('Linked');
});
