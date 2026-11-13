import {lstat,realpath,readFile,mkdir,open,unlink} from "node:fs/promises";
import path from "node:path";
import {z} from "zod";

export function within(root:string,value:string){const relative=path.relative(path.resolve(root),path.resolve(value));return relative===""||(!relative.startsWith('..'+path.sep)&&relative!==".."&&!path.isAbsolute(relative));}
export async function plainPath(value:string){
  if(!path.isAbsolute(value)||/[\r\n"<>]/.test(value))throw new Error("Explicit absolute private path required");
  let current=path.parse(value).root;for(const part of path.relative(current,value).split(path.sep).filter(Boolean)){current=path.join(current,part);try{if((await lstat(current)).isSymbolicLink())throw new Error("Linked operational path refused");}catch(error){if((error as NodeJS.ErrnoException).code!=="ENOENT")throw error;}}
  return path.resolve(value);
}
export const markerSchema=z.object({format:z.literal("all-items-synthetic"),installationId:z.uuid()}).strict();
export async function assertSynthetic(directory:string,id:string,personal:string,repository:string){
  const data=await plainPath(directory),privateRoot=await plainPath(personal);
  if(within(privateRoot,data)||within(data,privateRoot)||within(repository,data)||within(data,repository))throw new Error("Personal or repository data target refused");
  const canonical=await realpath(data);if(canonical.toLowerCase()!==data.toLowerCase())throw new Error("Noncanonical data target refused");
  const marker=markerSchema.parse(JSON.parse(await readFile(path.join(data,"synthetic-installation.json"),"utf8")));
  if(marker.installationId!==id)throw new Error("Synthetic installation identity mismatch");return data;
}
export async function withReleaseLock<T>(root:string,work:()=>Promise<T>){
  await plainPath(root);await mkdir(root,{recursive:true});const file=path.join(root,'operation.lock'),handle=await open(file,'wx',0o600);
  try{await handle.writeFile(String(process.pid));await handle.sync();return await work();}finally{await handle.close();await unlink(file);}
}
