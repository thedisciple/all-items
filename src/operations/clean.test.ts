import {it,expect} from 'vitest';
import {mkdtemp,mkdir,writeFile,readFile} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {activateClean,type CleanAdapter,type CleanPlan} from './clean';
import type {BetaConfig,State} from './release';

async function fixture(failProbe=false){
  const root=await mkdtemp(path.join(os.tmpdir(),'all-items-clean-')),events:string[]=[],sha='a'.repeat(40),id=crypto.randomUUID();let saved:State|null=null;
  const xml=path.join(root,'old.xml'),runtime=path.join(root,'old.env');await writeFile(xml,'legacy service pointer');await writeFile(runtime,'private original config');
  const config={releaseRoot:path.join(root,'releases'),installationId:id,appServiceXml:xml} as BetaConfig;
  await mkdir(path.join(config.releaseRoot,'private'),{recursive:true});await writeFile(path.join(config.releaseRoot,'private','acceptance.json'),JSON.stringify({users:[0,1].map(index=>({username:'synthetic-'+index,password:'Synthetic test password',inventory:crypto.randomUUID(),item:crypto.randomUUID(),media:crypto.randomUUID()}))}));
  const plan:CleanPlan={format:'clean-1',id:crypto.randomUUID(),installationId:id,candidate:sha,release:path.join(config.releaseRoot,sha),data:path.join(root,'staged'),runtime,createdAt:Date.now(),preflight:{id:crypto.randomUUID(),source:'unused',semanticHash:'b'.repeat(64)},drill:'unused'};await mkdir(plan.data);
  const step=async(name:string)=>{events.push(name);};
  const adapter:CleanAdapter={candidate:()=>step('CI'),assertData:()=>step('data'),validateRuntime:()=>step('runtime-check'),services:async()=>({app:'Running',caddy:'Running',binding:{release:root,runtime}}),build:async()=>plan.release,migrate:()=>step('migrate'),backup:async data=>{await step('backup');return{...plan.preflight,source:data};},restore:async()=>{await step('restore');return path.join(root,'fresh-copy');},runtime:async()=>runtime,stopApp:()=>step('stop'),startApp:()=>step('start'),switchApp:()=>step('switch'),probe:async()=>{await step('probe');if(failProbe)throw new Error('Acceptance failed');},save:async state=>{saved=state;await step('save');},journal:name=>step('journal:'+name),stopSharing:()=>step('stop-sharing'),restoreServiceXml:async(file,hash)=>{expect(hash).toMatch(/^[a-f0-9]{64}$/);expect(await readFile(file,'utf8')).toBe('legacy service pointer');await step('restore-legacy');}};
  return{config,plan,adapter,events,xml,runtime,get saved(){return saved;}};
}
it('requires explicit approval and snapshots staged edits before switching without inventing previous SHA',async()=>{
  const f=await fixture();await expect(activateClean(f.config,f.plan,'',f.adapter)).rejects.toThrow('approval');expect(f.events).toEqual([]);
  const result=await activateClean(f.config,f.plan,f.config.installationId,f.adapter);
  expect(result.previousManagedRelease).toBeNull();expect(f.saved?.previous).toBeUndefined();expect(f.saved?.current.data).not.toBe(f.plan.data);
  expect(f.events.indexOf('stop')).toBeLessThan(f.events.indexOf('backup'));expect(f.events.indexOf('probe')).toBeLessThan(f.events.indexOf('save'));
  expect(await readFile(f.xml,'utf8')).toBe('legacy service pointer');expect(await readFile(f.runtime,'utf8')).toBe('private original config');
});
it('restores the exact legacy pointer after failed acceptance, leaves recovery latched and does not save a false managed baseline',async()=>{
  const f=await fixture(true);await expect(activateClean(f.config,f.plan,f.config.installationId,f.adapter)).rejects.toThrow('Acceptance failed');
  expect(f.events).toContain('restore-legacy');expect(f.events).not.toContain('save');expect(f.events).not.toContain('journal:recovered');expect(f.events).not.toContain('journal:clean-complete');expect(f.events.at(-1)).toBe('start');
});
