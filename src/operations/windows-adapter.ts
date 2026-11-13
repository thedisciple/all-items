import {access,copyFile,mkdir,readFile,writeFile,rename,open,unlink} from "node:fs/promises";
import {createReadStream} from "node:fs";
import {createHash,randomUUID} from "node:crypto";
import path from "node:path";
import {createBackup,verifyBackup,restoreDrill} from "../backup/service";
import {configSchema,type BetaConfig,type ReleaseAdapter,type State} from "./release";
import {assertSynthetic,plainPath,within} from "./paths";
import {runtimeValues,isolatedEnvironment,pinnedFunnel} from "./environment";
import {buildRelease} from "./build";
import {command} from "./process";

export async function loadConfig(file:string){
  const config=configSchema.parse(JSON.parse(await readFile(file,'utf8')));
  for(const value of[file,config.repository,config.dataDirectory,config.personalDataDirectory,config.releaseRoot,config.runtimeConfig,config.appServiceXml,config.tailscaleExecutable])await plainPath(value);
  for(const value of[file,config.dataDirectory,config.releaseRoot,config.runtimeConfig,config.appServiceXml])if(within(config.repository,value))throw new Error('Private operations paths must be outside source repository');
  if(within(config.personalDataDirectory,config.releaseRoot)||within(config.releaseRoot,config.personalDataDirectory)||within(config.releaseRoot,config.dataDirectory)||within(config.dataDirectory,config.releaseRoot))throw new Error('Release, personal and initial test data paths must be separate');
  return config;
}
async function durable(file:string,value:unknown){await mkdir(path.dirname(file),{recursive:true});const temporary=file+'.'+randomUUID(),handle=await open(temporary,'wx',0o600);try{await handle.writeFile(JSON.stringify(value,null,2));await handle.sync();}finally{await handle.close();}await rename(temporary,file);}
export function windowsAdapter(config:BetaConfig,configFile:string):ReleaseAdapter{
  const service=(action:string,extra:string[]=[])=>command('powershell.exe',['-NoProfile','-NonInteractive','-File',path.join(config.repository,'scripts/beta-services.ps1'),'-Action',action,'-ConfigPath',configFile,...extra],config.repository);
  const assertData=async(data:string)=>{await assertSynthetic(data,config.installationId,config.personalDataDirectory,config.repository);};
  return{
    assertData,
    services:async()=>JSON.parse(await service('status')),
    candidate:async sha=>{
      const branch=await command('git',['branch','--show-current'],config.repository);if(!branch)throw new Error('A reviewable feature branch is required');
      const remote=await command('git',['ls-remote','origin',`refs/heads/${branch}`],config.repository);if(remote.split(/\s/)[0]!==sha)throw new Error('Candidate must be the pushed branch head');
      const pr=JSON.parse(await command('gh',['pr','view',branch,'--json','headRefOid,state,isDraft,url,statusCheckRollup'],config.repository));
      if(pr.headRefOid!==sha||pr.state!=='OPEN'||!pr.isDraft||!pr.statusCheckRollup.length||pr.statusCheckRollup.some((check:{conclusion?:string;state?:string})=>check.conclusion!=='SUCCESS'&&check.state!=='SUCCESS'))throw new Error('Candidate PR/CI gate is not green');
    },
    validateRuntime:async(runtime,data)=>{
      await assertData(data);await plainPath(runtime);if(within(config.repository,runtime))throw new Error('Private runtime file required');
      const values=runtimeValues(await readFile(runtime,'utf8'));if(values.ALL_ITEMS_ORIGIN!==config.publicOrigin||values.ALL_ITEMS_PROXY_MODE!=='https-proxy'||path.resolve(values.ALL_ITEMS_DATA_DIR??'')!==path.resolve(data))throw new Error('Runtime target/origin mismatch');
      // This only validates. It never starts or changes a service.
      await command('powershell.exe',['-NoProfile','-NonInteractive','-File',path.join(config.repository,'scripts/start-production.ps1'),'-ConfigPath',runtime,'-ValidateOnly'],config.repository);
      const funnel=JSON.parse(await command(config.tailscaleExecutable,['funnel','status','--json'],config.repository));if(!pinnedFunnel(funnel,config.publicOrigin))throw new Error('Funnel must already be pinned to the loopback Caddy adapter');
    },
    build:sha=>buildRelease(config.repository,config.releaseRoot,sha),
    backup:async(data)=>{await assertData(data);const result=await createBackup(data,{pinned:true});await verifyBackup(data,result.manifest.id);return{id:result.manifest.id,source:data,semanticHash:result.manifest.semanticHash};},
    restore:async backup=>{
      await assertData(backup.source);const verified=await verifyBackup(backup.source,backup.id);if(verified.manifest.semanticHash!==backup.semanticHash)throw new Error('Backup identity mismatch');
      await restoreDrill(backup.source,backup.id);const target=path.join(config.releaseRoot,'installations',randomUUID());await mkdir(target,{recursive:true});
      for(const entry of verified.manifest.files){const destination=path.join(target,entry.path);await mkdir(path.dirname(destination),{recursive:true});await copyFile(path.join(verified.path,entry.path),destination);const hash=createHash('sha256');for await(const bytes of createReadStream(destination))hash.update(bytes);if(hash.digest('hex')!==entry.sha256)throw new Error('Restored file checksum mismatch');}
      const inspection=JSON.parse(await command(process.execPath,['--import','tsx','src/backup/worker.ts','inspect',target],config.repository));if(inspection.semanticHash!==backup.semanticHash)throw new Error('Restored database mismatch');
      await writeFile(path.join(target,'synthetic-installation.json'),JSON.stringify({format:'all-items-synthetic',installationId:config.installationId}),{flag:'wx',mode:0o600});return target;
    },
    migrate:async(release,data)=>{
      await assertData(data);await command(process.execPath,['--import','tsx','src/db/migrate.ts'],release,isolatedEnvironment(data,'http://127.0.0.1:3200',path.basename(release)));
      await command(process.execPath,['--import','tsx','src/backup/worker.ts','inspect',data],release);
    },
    runtime:async(previous,data,sha)=>{
      await assertData(data);const old=runtimeValues(await readFile(previous,'utf8'));old.ALL_ITEMS_DATA_DIR=data;
      const target=path.join(config.releaseRoot,'private',sha+'-'+randomUUID()+'.env');await mkdir(path.dirname(target),{recursive:true});await writeFile(target,Object.entries(old).map(([key,value])=>`${key}=${value}`).join('\n'),{flag:'wx',mode:0o600});return target;
    },
    stopApp:async()=>{await service('stop-app');},startApp:async()=>{await service('start-app');},stopSharing:async()=>{await service('stop-sharing');},
    switchApp:async release=>{
      if(!within(config.releaseRoot,release.release)||path.basename(release.release)!==release.sha)throw new Error('Unmanaged release refused');await plainPath(release.release);await assertData(release.data);
      const receipt=JSON.parse(await readFile(path.join(release.release,'.all-items-release.json'),'utf8'));if(receipt.sha!==release.sha)throw new Error('Release build receipt mismatch');await access(path.join(release.release,'.next/BUILD_ID'));
      await service('switch',['-Release',release.release,'-Runtime',release.runtime]);
    },
    probe:async release=>{
      const services=JSON.parse(await service('status'));if(services.app!=='Running'||services.caddy!=='Running')throw new Error('Service health failed');
      const runtime=runtimeValues(await readFile(release.runtime,'utf8'));
      const local=await fetch('http://127.0.0.1:8787/api/health',{headers:{Host:new URL(config.publicOrigin).host},signal:AbortSignal.timeout(15000)});const health=await local.json();if(!local.ok||health.revision!==release.sha)throw new Error('Loopback adapter version mismatch');
      // Credentials are supplied only in a separate private acceptance file.
      await command(process.execPath,['--import','tsx','scripts/beta-probe.ts','--origin',config.publicOrigin,'--sha',release.sha,'--credentials',path.join(config.releaseRoot,'private','acceptance.json')],config.repository,{...isolatedEnvironment(release.data,'http://127.0.0.1:3200',release.sha),ALL_ITEMS_EXPECT_TELEGRAM:runtime.ALL_ITEMS_TELEGRAM_CLIENT_ID?'configured':'absent'});
    },
    save:state=>durable(path.join(config.releaseRoot,'state.json'),state),
    journal:async(event,value)=>{
      const record={event,at:new Date().toISOString(),value};await durable(path.join(config.releaseRoot,'journals',Date.now()+'-'+randomUUID()+'.json'),record);
      const latch=path.join(config.releaseRoot,'recovery-required.json');if(['stopping','rollback-stopping'].includes(event))await durable(latch,record);
      if(['complete','rollback-complete','recovered'].includes(event))await unlink(latch).catch(error=>{if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;});
    },
  };
}
export async function status(config:BetaConfig,state:State|null,adapter:ReleaseAdapter){
  const blocks:string[]=[];try{await adapter.assertData(state?.current.data??config.dataDirectory);}catch{blocks.push('synthetic-marker-or-private-path-not-verified');}
  try{await adapter.validateRuntime(state?.current.runtime??config.runtimeConfig,state?.current.data??config.dataDirectory);}catch{blocks.push('runtime-not-verified');}
  const services=await adapter.services().catch(()=>({app:'Unknown',caddy:'Unknown'}));if(services.app!=='Running'||services.caddy!=='Running')blocks.push('services-not-already-running');
  let tunnel='unavailable';try{const value=JSON.parse(await command(config.tailscaleExecutable,['funnel','status','--json'],config.repository));tunnel=pinnedFunnel(value,config.publicOrigin)?'pinned-loopback-adapter':'not-configured-or-mismatched';if(tunnel!=='pinned-loopback-adapter')blocks.push('tunnel-not-pinned');}catch{blocks.push('tunnel-status-unavailable');}
  if(!state)blocks.push('deployed-build-sha-unknown-needs-reviewed-baseline');
  try{await access(path.join(config.releaseRoot,'recovery-required.json'));blocks.push('interrupted-operation-needs-review');}catch{/* No recorded interrupted switch. */}
  return{deployedSha:state?.current.sha??null,checkoutSha:await command('git',['rev-parse','HEAD'],config.repository),services,tunnel,blocks};
}
