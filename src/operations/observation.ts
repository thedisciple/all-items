import {z} from 'zod';
import path from 'node:path';
import {readFile} from 'node:fs/promises';
import {request} from 'node:http';
import {runtimeValues,revision} from './environment';
import type {BetaConfig,Deployed,Services} from './release';

const healthSchema=z.object({status:z.literal('ok'),version:z.string().max(40),revision:revision.nullable()}).strict();
export type HealthObservation={state:'verified-response'|'version-unknown'|'unavailable'|'origin-denied';sha:string|null;http:number|null};
export async function observe(url:string,headers:Record<string,string>={},fetcher:typeof fetch=fetch):Promise<HealthObservation>{
  try{const response=await fetcher(url,{headers,redirect:'manual',signal:AbortSignal.timeout(3000)});if(response.status===403)return{state:'origin-denied',sha:null,http:403};if(response.status===404)return{state:'version-unknown',sha:null,http:404};
    if(!response.ok)return{state:'unavailable',sha:null,http:response.status};
    if(!response.body)throw new Error('Missing health response');const reader=response.body.getReader();let bytes=0;const chunks:Uint8Array[]=[];
    try{while(true){const chunk=await reader.read();if(chunk.done)break;bytes+=chunk.value.byteLength;if(bytes>4096)throw new Error('Oversized health response');chunks.push(chunk.value);}}finally{await reader.cancel();}
    const body=healthSchema.parse(JSON.parse(Buffer.concat(chunks).toString('utf8')));return{state:body.revision?'verified-response':'version-unknown',sha:body.revision,http:response.status};
  }catch{return{state:'unavailable',sha:null,http:null};}
}
// Node fetch can ignore a custom Host. Use native HTTP only for these controlled loopback probes.
export const loopbackFetch:typeof fetch=async(input,init)=>{
  const url=new URL(String(input));if(url.protocol!=='http:'||url.hostname!=='127.0.0.1'||url.pathname!=='/api/health'||url.username||url.password)throw new Error('Controlled loopback health URL required');
  return new Promise((resolve,reject)=>{
    const req=request(url,{method:'GET',headers:Object.fromEntries(new Headers(init?.headers)),signal:init?.signal??undefined},response=>{
      const status=response.statusCode??502;if(status!==200){response.destroy();resolve(new Response(null,{status}));return;}
      const chunks:Buffer[]=[];let size=0;response.on('data',(chunk:Buffer)=>{size+=chunk.length;if(size>4096){response.destroy(new Error('Oversized health response'));return;}chunks.push(chunk);});
      response.on('error',reject);response.on('end',()=>resolve(new Response(Buffer.concat(chunks),{status})));
    });req.on('error',reject);req.setTimeout(3000,()=>req.destroy(new Error('Health deadline exceeded')));req.end();
  });
};
export async function observeInstallation(config:BetaConfig,current:Deployed|null,fetcher?:typeof fetch){
  const runtime=runtimeValues(await readFile(current?.runtime??config.runtimeConfig,'utf8'));
  if(runtime.ALL_ITEMS_ORIGIN!==config.publicOrigin||runtime.ALL_ITEMS_PROXY_MODE!=='https-proxy'||!runtime.ALL_ITEMS_PROXY_SECRET)throw new Error('Runtime origin is not verified');
  const host=new URL(config.publicOrigin).host;
  const [backend,proxy,external]=await Promise.all([
    observe('http://127.0.0.1:3000/api/health',{Host:host,'x-forwarded-host':host,'x-forwarded-proto':'https','x-forwarded-port':'443','x-all-items-proxy-secret':runtime.ALL_ITEMS_PROXY_SECRET},fetcher??loopbackFetch),
    observe('http://127.0.0.1:8787/api/health',{Host:host},fetcher??loopbackFetch),observe(config.publicOrigin+'/api/health',{},fetcher??fetch)]);
  return{backend,proxy,external};
}
export function classifyStatus(services:Services,recorded:Deployed|null,health:{backend:HealthObservation;proxy:HealthObservation;external:HealthObservation},recovery:boolean,acceptanceFailed:boolean){
  const binding=Boolean(recorded&&services.binding&&path.resolve(services.binding.release)===path.resolve(recorded.release)&&services.binding.runtime&&path.resolve(services.binding.runtime)===path.resolve(recorded.runtime));
  const versionMatches=Boolean(recorded&&health.backend.sha===recorded.sha),verified=versionMatches&&binding;
  const state=recovery?'recovery-required':acceptanceFailed?'acceptance-failed':services.app!=='Running'?'application-unavailable':services.caddy!=='Running'||health.proxy.state==='unavailable'?'proxy-unavailable':!health.backend.sha?'running-version-unknown':!verified?'running-version-mismatch':health.external.state==='unavailable'?'remote-unreachable':health.proxy.sha!==recorded?.sha||health.external.sha!==recorded?.sha?'remote-version-mismatch':'running-and-version-verified';
  return{state,deployedSha:health.backend.sha,recordedSha:recorded?.sha??null,bindingVerified:binding,versionVerified:verified,health};
}
