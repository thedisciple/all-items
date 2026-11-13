import {it,expect} from "vitest";
import {prepare,deploy,rollback,stopSharing,type BetaConfig,type State,type ReleaseAdapter} from "./release";
import {isolatedEnvironment,runtimeValues,pinnedFunnel} from "./environment";

const sha='a'.repeat(40),next='b'.repeat(40),id='00000000-0000-4000-8000-000000000099';
const config={installationId:id} as BetaConfig,state:State={current:{sha,release:'/releases/'+sha,data:'/synthetic/old',runtime:'/private/old.env'}};
function fixture(fail=''){
  const events:string[]=[];let copies=0;let saved:State|undefined;
  const step=async(name:string)=>{events.push(name);if(name===fail)throw new Error('Injected '+name);};
  const adapter:ReleaseAdapter={assertData:()=>step('assert-data'),services:async()=>{await step('services');return{app:'Running',caddy:'Running'};},candidate:()=>step('CI'),validateRuntime:()=>step('validate'),build:async()=>{await step('build');return'/releases/'+next;},backup:async data=>{await step('backup');return{id:crypto.randomUUID(),source:data,semanticHash:'c'.repeat(64)};},restore:async()=>{await step('restore');return'/synthetic/copy-'+(++copies);},migrate:(_release,data)=>step('migrate:'+data),runtime:async()=>{await step('runtime');return'/private/new.env';},stopApp:()=>step('stop'),switchApp:release=>step('switch:'+release.sha),startApp:()=>step('start'),probe:()=>step('probe'),save:async value=>{await step('save');saved=value;},journal:(name)=>step('journal:'+name),stopSharing:()=>step('stop-sharing')};
  return{adapter,events,get saved(){return saved;}};
}
it('scrubs inherited runtime secrets, validates local origin and never logs configuration values',()=>{
  const env=isolatedEnvironment('/preview','http://127.0.0.1:3200',sha,{NODE_ENV:'test',PATH:'retained',ALL_ITEMS_PROXY_SECRET:'private',ALL_ITEMS_TELEGRAM_CLIENT_SECRET:'private',ALL_ITEMS_DATA_DIR:'/personal',NODE_OPTIONS:'--inspect'});
  expect(env).toMatchObject({PATH:'retained',ALL_ITEMS_DATA_DIR:'/preview',ALL_ITEMS_RELEASE_SHA:sha});expect(env.ALL_ITEMS_PROXY_SECRET).toBeUndefined();expect(env.ALL_ITEMS_TELEGRAM_CLIENT_SECRET).toBeUndefined();expect(env.NODE_OPTIONS).toBeUndefined();
  expect(()=>isolatedEnvironment('/x','https://example.org',sha)).toThrow();expect(()=>runtimeValues('ALL_ITEMS_PROXY_SECRET=x\nALL_ITEMS_PROXY_SECRET=y')).toThrow();expect(()=>runtimeValues('NODE_OPTIONS=--inspect')).toThrow();
  expect(pinnedFunnel(null,'https://synthetic.example.ts.net')).toBe(false);expect(pinnedFunnel({AllowFunnel:{'synthetic.example.ts.net:443':true},TCP:{'443':{TCPForward:'127.0.0.1:3000'}}},'https://synthetic.example.ts.net')).toBe(false);expect(pinnedFunnel({AllowFunnel:{'synthetic.example.ts.net:443':true},TCP:{'443':{TCPForward:'127.0.0.1:8787'}}},'https://synthetic.example.ts.net')).toBe(true);
});
it('prepares a verified restore/migration drill without stopping or switching services',async()=>{
  const f=fixture(),plan=await prepare(config,state,next,f.adapter);expect(plan.previous).toEqual(state.current);expect(f.events).toContain('migrate:/synthetic/copy-1');expect(f.events).not.toContain('stop');expect(f.events.some(event=>event.startsWith('switch:'))).toBe(false);
});
it('refuses missing approval, stale identity/state, failed CI and stopped adapter before mutation',async()=>{
  const f=fixture(),plan=await prepare(config,state,next,f.adapter);f.events.length=0;await expect(deploy(config,state,plan,'',f.adapter)).rejects.toThrow('approval');expect(f.events).toEqual([]);
  await expect(deploy(config,state,{...plan,createdAt:0},id,f.adapter)).rejects.toThrow('stale');
  const failed=fixture('CI');await expect(prepare(config,state,next,failed.adapter)).rejects.toThrow();expect(failed.events).not.toContain('backup');expect(failed.events).not.toContain('stop');
  f.adapter.services=async()=>({app:'Running',caddy:'Stopped'});await expect(deploy(config,state,plan,id,f.adapter)).rejects.toThrow('state changed');expect(f.events).not.toContain('stop');
});
it('takes a fresh stopped backup, migrates only a new copy, probes before committing state',async()=>{
  const f=fixture(),plan=await prepare(config,state,next,f.adapter);f.events.length=0;const result=await deploy(config,state,plan,id,f.adapter);
  expect(f.events.indexOf('stop')).toBeLessThan(f.events.indexOf('backup'));expect(f.events).toContain('migrate:/synthetic/copy-2');expect(f.events).not.toContain('migrate:/synthetic/old');expect(f.events.indexOf('probe')).toBeLessThan(f.events.indexOf('save'));expect(result.previous!.backup.source).toBe(state.current.data);expect(f.saved).toEqual(result);
});
it('keeps original code/data reachable on snapshot, migration and post-switch failures',async()=>{
  for(const failure of['backup','migrate:/synthetic/copy-2','probe']){
    const f=fixture(),plan=await prepare(config,state,next,f.adapter);if(failure==='backup')f.adapter.backup=async()=>{f.events.push('backup');throw new Error('Injected backup');};else if(failure.startsWith('migrate:'))f.adapter.migrate=async(_release,data)=>{f.events.push('migrate:'+data);if(data.endsWith('2'))throw new Error('Injected migration');};else f.adapter.probe=async()=>{throw new Error('Injected probe');};
    await expect(deploy(config,state,plan,id,f.adapter)).rejects.toThrow();if(f.saved)expect(f.saved).toEqual(state);expect(f.events).toContain('start');if(failure==='probe')expect(f.events).toContain('switch:'+sha);
  }
});
it('rolls back matching code plus restored snapshot, preserving current test changes separately',async()=>{
  const f=fixture(),plan=await prepare(config,state,next,f.adapter),installed=await deploy(config,state,plan,id,f.adapter);f.events.length=0;
  const restored=await rollback(config,installed,id,f.adapter);expect(restored.current.sha).toBe(sha);expect(restored.current.data).not.toBe(state.current.data);expect(f.events).not.toContain('migrate:/synthetic/old');expect(f.events.indexOf('backup')).toBeLessThan(f.events.indexOf('restore'));expect(f.events).toContain('switch:'+sha);
});
it('stops only the known sharing adapter after explicit installation approval',async()=>{
  const f=fixture();await expect(stopSharing(config,'',f.adapter)).rejects.toThrow();expect(f.events).toEqual([]);await stopSharing(config,id,f.adapter);expect(f.events).toEqual(['assert-data','journal:stop-sharing','stop-sharing']);
});
