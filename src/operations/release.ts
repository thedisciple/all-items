import {z} from "zod";
import {revision} from "./environment";

export const configSchema=z.object({format:z.literal(1),purpose:z.literal('synthetic-only'),installationId:z.uuid(),repository:z.string(),dataDirectory:z.string(),personalDataDirectory:z.string(),releaseRoot:z.string(),runtimeConfig:z.string(),appService:z.string().regex(/^[A-Za-z0-9_-]+$/),caddyService:z.string().regex(/^[A-Za-z0-9_-]+$/),appServiceXml:z.string(),publicOrigin:z.url().refine(value=>{const url=new URL(value);return url.protocol==='https:'&&url.hostname.endsWith('.ts.net')&&url.origin===value;}),tailscaleExecutable:z.string()}).strict();
export type BetaConfig=z.infer<typeof configSchema>;
export const deployedSchema=z.object({sha:revision,release:z.string(),data:z.string(),runtime:z.string()}).strict();
export type Deployed=z.infer<typeof deployedSchema>;
export type Backup={id:string;source:string;semanticHash:string};
export type State={current:Deployed;previous?:Deployed&{backup:Backup}};
export type Plan={format:1;id:string;installationId:string;candidate:string;previous:Deployed;createdAt:number;release:string;preflight:Backup;drill:string};
export type Services={app:string;caddy:string};

// Injectable boundary: tests use real isolated backups and mocked services; no hidden live mode.
export interface ReleaseAdapter{
  assertData(data:string):Promise<void>;
  services():Promise<Services>;
  candidate(sha:string):Promise<void>;
  validateRuntime(runtime:string,data:string):Promise<void>;
  build(sha:string):Promise<string>;
  backup(data:string):Promise<Backup>;
  restore(backup:Backup):Promise<string>;
  migrate(release:string,data:string):Promise<void>;
  runtime(previous:string,data:string,sha:string):Promise<string>;
  stopApp():Promise<void>;
  switchApp(release:Deployed):Promise<void>;
  startApp():Promise<void>;
  probe(release:Deployed):Promise<void>;
  save(state:State):Promise<void>;
  journal(event:string,value:unknown):Promise<void>;
  stopSharing():Promise<void>;
}
export async function prepare(config:BetaConfig,state:State,sha:string,adapter:ReleaseAdapter):Promise<Plan>{
  revision.parse(sha);await adapter.assertData(state.current.data);await adapter.candidate(sha);
  const services=await adapter.services();if(services.app!=='Running'||services.caddy!=='Running')throw new Error('Both beta services must already be running; prepare never enables sharing');
  await adapter.validateRuntime(state.current.runtime,state.current.data);
  const release=await adapter.build(sha),preflight=await adapter.backup(state.current.data),drill=await adapter.restore(preflight);await adapter.migrate(release,drill);
  const plan:Plan={format:1,id:crypto.randomUUID(),installationId:config.installationId,candidate:sha,previous:state.current,createdAt:Date.now(),release,preflight,drill};await adapter.journal('prepared',plan);return plan;
}
function approval(config:BetaConfig,approved:string){if(approved!==config.installationId)throw new Error('Explicit installation-specific approval required');}
export async function deploy(config:BetaConfig,state:State,plan:Plan,approved:string,adapter:ReleaseAdapter){
  approval(config,approved);
  if(plan.installationId!==config.installationId||plan.createdAt>Date.now()+5000||Date.now()-plan.createdAt>30*60_000||JSON.stringify(plan.previous)!==JSON.stringify(state.current))throw new Error('Expired or stale deployment plan');
  await adapter.assertData(state.current.data);await adapter.candidate(plan.candidate);await adapter.validateRuntime(state.current.runtime,state.current.data);
  const services=await adapter.services();if(services.app!=='Running'||services.caddy!=='Running')throw new Error('Service state changed; prepare again');
  let switched=false;
  await adapter.journal('stopping',{plan:plan.id,previous:state.current});await adapter.stopApp();
  try{
    // Fresh stopped-writer snapshot; the prepared snapshot may predate intervening edits.
    const backup=await adapter.backup(state.current.data),data=await adapter.restore(backup);await adapter.migrate(plan.release,data);
    const runtime=await adapter.runtime(state.current.runtime,data,plan.candidate),next={sha:plan.candidate,release:plan.release,data,runtime};
    await adapter.journal('switching',{previous:state.current,next,backup});switched=true;await adapter.switchApp(next);await adapter.startApp();await adapter.probe(next);
    const result={current:next,previous:{...state.current,backup}};await adapter.save(result);await adapter.journal('complete',{sha:next.sha});return result;
  }catch(error){
    await adapter.journal('failed',{plan:plan.id,switched});
    if(switched){await adapter.stopApp();await adapter.switchApp(state.current);}await adapter.startApp();await adapter.probe(state.current);await adapter.save(state);await adapter.journal('recovered',{sha:state.current.sha});
    // The old data directory was never migrated or overwritten.
    throw error;
  }
}
export async function rollback(config:BetaConfig,state:State,approved:string,adapter:ReleaseAdapter){
  approval(config,approved);if(!state.previous)throw new Error('No verified previous release recorded');
  await adapter.assertData(state.current.data);await adapter.validateRuntime(state.previous.runtime,state.previous.data);await adapter.journal('rollback-stopping',{current:state.current,previous:state.previous});await adapter.stopApp();
  try{
    const preservation=await adapter.backup(state.current.data),data=await adapter.restore(state.previous.backup),runtime=await adapter.runtime(state.previous.runtime,data,state.previous.sha);
    const next={sha:state.previous.sha,release:state.previous.release,data,runtime};await adapter.journal('rollback-switching',{next,preservation});await adapter.switchApp(next);await adapter.startApp();await adapter.probe(next);
    const result={current:next,previous:{...state.current,backup:preservation}};await adapter.save(result);await adapter.journal('rollback-complete',{sha:next.sha});return result;
  }catch(error){await adapter.journal('rollback-failed',{});await adapter.stopApp();await adapter.switchApp(state.current);await adapter.startApp();await adapter.probe(state.current);await adapter.save(state);await adapter.journal('recovered',{sha:state.current.sha});throw error;}
}
export async function stopSharing(config:BetaConfig,approved:string,adapter:ReleaseAdapter){approval(config,approved);await adapter.assertData(config.dataDirectory);await adapter.journal('stop-sharing',{});await adapter.stopSharing();}
