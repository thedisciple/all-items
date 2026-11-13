import {it,expect} from 'vitest';
import {mkdtemp,writeFile,readFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {withCurrentState,writePrivateJson,readState,recoveryRequired} from './state';
it('reads current state under the exclusive lock and refuses stale/corrupt state',async()=>{
  const root=await mkdtemp(path.join(os.tmpdir(),'all-items-state-'));
  expect(await readState(root)).toBeNull();
  await withCurrentState(root,async(state)=>{expect(state).toBeNull();expect(await readFile(path.join(root,'operation.lock'),'utf8')).toBe(String(process.pid));await expect(withCurrentState(root,async()=>{})).rejects.toMatchObject({code:'EEXIST'});});
  await writeFile(path.join(root,'state.json'),'{}');await expect(withCurrentState(root,async()=>{throw new Error('must not execute');})).rejects.not.toThrow('must not execute');
  expect(await recoveryRequired(root)).toBe(false);await writePrivateJson(path.join(root,'recovery-required.json'),{});expect(await recoveryRequired(root)).toBe(true);
});
