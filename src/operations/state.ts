import {access,readFile,open,mkdir,rename} from 'node:fs/promises';
import path from 'node:path';
import {z} from 'zod';
import {deployedSchema,type State} from './release';
import {plainPath,withReleaseLock} from './paths';

export const backupSchema=z.object({id:z.uuid(),source:z.string(),semanticHash:z.string().regex(/^[a-f0-9]{64}$/)}).strict();
export const stateSchema=z.object({current:deployedSchema,previous:deployedSchema.extend({backup:backupSchema}).optional()}).strict();
export async function readPrivateJson(file:string){await plainPath(file);const value=await readFile(file,'utf8');if(Buffer.byteLength(value)>65536)throw new Error('Oversized operational record');return JSON.parse(value) as unknown;}
export async function readState(root:string):Promise<State|null>{try{return stateSchema.parse(await readPrivateJson(path.join(root,'state.json')));}catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return null;throw error;}}
export async function recoveryRequired(root:string){try{await access(path.join(root,'recovery-required.json'));return true;}catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return false;throw error;}}
export async function withCurrentState<T>(root:string,work:(state:State|null)=>Promise<T>){return withReleaseLock(root,async()=>work(await readState(root)));}
export async function writePrivateJson(file:string,value:unknown){
  await plainPath(file);await mkdir(path.dirname(file),{recursive:true});const temporary=file+'.'+crypto.randomUUID(),handle=await open(temporary,'wx',0o600);
  try{await handle.writeFile(JSON.stringify(value,null,2));await handle.sync();}finally{await handle.close();}await rename(temporary,file);
}
