import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {randomUUID,createHash} from 'node:crypto';
import path from 'node:path';
import {z} from 'zod';
import {revision} from './environment';
import {backupSchema,readPrivateJson,writePrivateJson} from './state';
import type {BetaConfig,ReleaseAdapter,Deployed} from './release';
import {plainPath} from './paths';
import {readAcceptanceFixture} from './acceptance';

export const cleanPlanSchema=z.object({format:z.literal('clean-1'),id:z.uuid(),installationId:z.uuid(),candidate:revision,release:z.string(),data:z.string(),runtime:z.string(),createdAt:z.number().int(),preflight:backupSchema,drill:z.string()}).strict();
export type CleanPlan=z.infer<typeof cleanPlanSchema>;
export async function prepareClean(config:BetaConfig,sha:string,adapter:ReleaseAdapter){
  revision.parse(sha);await adapter.candidate(sha);
  const release=await adapter.build(sha),data=path.join(config.releaseRoot,'installations',randomUUID());
  await plainPath(data);await mkdir(path.dirname(data),{recursive:true});await mkdir(data);
  // Only a freshly generated directory is marked. The legacy data target is never opened.
  await writeFile(path.join(data,'synthetic-installation.json'),JSON.stringify({format:'all-items-synthetic',installationId:config.installationId}),{flag:'wx',mode:0o600});
  await adapter.migrate(release,data);
  const runtime=await adapter.runtime(config.runtimeConfig,data,sha),preflight=await adapter.backup(data),drill=await adapter.restore(preflight);
  const plan:CleanPlan={format:'clean-1',id:randomUUID(),installationId:config.installationId,candidate:sha,release,data,runtime,createdAt:Date.now(),preflight,drill};
  await adapter.journal('clean-prepared',plan);return plan;
}
export async function readCleanPlan(config:BetaConfig,file:string){
  const plan=cleanPlanSchema.parse(await readPrivateJson(file));
  if(file!==path.join(config.releaseRoot,'plans',plan.id+'.json')||plan.installationId!==config.installationId||plan.release!==path.join(config.releaseRoot,plan.candidate)||path.dirname(plan.data)!==path.join(config.releaseRoot,'installations')||path.dirname(plan.runtime)!==path.join(config.releaseRoot,'private'))throw new Error('Unmanaged clean plan refused');
  return plan;
}
export interface CleanAdapter extends ReleaseAdapter{restoreServiceXml(file:string,sha256:string):Promise<void>}
export async function activateClean(config:BetaConfig,plan:CleanPlan,approved:string,adapter:CleanAdapter){
  if(approved!==config.installationId)throw new Error('Explicit installation-specific approval required');
  if(plan.createdAt>Date.now()+5000||Date.now()-plan.createdAt>7*86400_000)throw new Error('Clean preparation expired; prepare again');
  await readAcceptanceFixture(path.join(config.releaseRoot,'private','acceptance.json'));
  await adapter.candidate(plan.candidate);await adapter.assertData(plan.data);await adapter.validateRuntime(plan.runtime,plan.data);
  const services=await adapter.services();if(!['Running','Stopped'].includes(services.app)||services.caddy!=='Running'||!services.binding?.runtime)throw new Error('Review service binding and existing proxy first');
  // Preserve the original pointer and private configuration, without inventing legacy code identity.
  await plainPath(services.binding.runtime);await plainPath(config.appServiceXml);
  const xml=await readFile(config.appServiceXml),runtime=await readFile(services.binding.runtime);
  const directory=path.join(config.releaseRoot,'private','legacy-'+randomUUID());await mkdir(directory,{recursive:true});
  const xmlFile=path.join(directory,'service.xml'),xmlHash=createHash('sha256').update(xml).digest('hex');
  await writeFile(xmlFile,xml,{flag:'wx',mode:0o600});await writeFile(path.join(directory,'runtime.env'),runtime,{flag:'wx',mode:0o600});
  await writePrivateJson(path.join(directory,'recovery.json'),{format:1,xmlHash,previousServiceState:services.app,binding:services.binding,legacySha:null,legacyDataPreserved:true});
  await adapter.journal('clean-stopping',{plan:plan.id,xmlFile,xmlHash,legacySha:null});
  let switched=false;
  try{
    if(services.app==='Running')await adapter.stopApp();
    // Include accounts or synthetic edits created since prepare; never modify the staged copy.
    const backup=await adapter.backup(plan.data),data=await adapter.restore(backup),runtime=await adapter.runtime(plan.runtime,data,plan.candidate);
    const next:Deployed={sha:plan.candidate,release:plan.release,data,runtime};
    await adapter.journal('clean-switching',{next,xmlFile,xmlHash,backup});switched=true;await adapter.switchApp(next);await adapter.startApp();await adapter.probe(next);
    await adapter.save({current:next});await adapter.journal('clean-complete',{sha:next.sha,legacyRecovery:directory});return{current:next,legacyRecovery:directory,previousManagedRelease:null};
  }catch(error){
    await adapter.journal('clean-failed',{switched,xmlFile,xmlHash});
    if(switched){await adapter.stopApp();await adapter.restoreServiceXml(xmlFile,xmlHash);}
    if(services.app==='Running')await adapter.startApp();
    // The unidentified legacy application is restored, but cannot pass managed acceptance.
    // Keep the recovery latch for explicit inspection, rather than claiming recovery verified.
    throw error;
  }
}
