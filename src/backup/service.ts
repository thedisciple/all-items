import { type Client } from "@libsql/client";
import { createHash, randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createReadStream, createWriteStream } from "node:fs";
import { lstat, mkdir, mkdtemp, open, readFile, readdir, rename, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { z } from "zod";
import { assertPrivatePath } from "@/media/private-paths";
import { withInventoryOperation } from "@/items/operation-lock";

const MAX_FILES=100_000, MAX_BYTES=50*1024**3, MAX_FILE=1024**3;
const entry=z.object({path:z.string().max(200),size:z.number().int().nonnegative().max(MAX_FILE),sha256:z.string().regex(/^[a-f0-9]{64}$/)}).strict();
const manifestSchema=z.object({format:z.literal("all-items-installation"),version:z.literal(1),id:z.uuid(),createdAt:z.iso.datetime(),pinned:z.boolean(),application:z.literal("0.1.0"),migrations:z.array(z.string()).max(100),semanticHash:z.string().regex(/^[a-f0-9]{64}$/),files:z.array(entry).min(1).max(MAX_FILES)}).strict();
export type BackupManifest=z.infer<typeof manifestSchema>;
type Fault="snapshot"|"copy"|"manifest"|"complete";
const digest=(value:string)=>createHash("sha256").update(value).digest("hex");
const quoted=(value:string)=>'"'+value.replaceAll('"','""')+'"';
async function durable(file:string,value:string){const h=await open(file,"wx");try{await h.writeFile(value);await h.sync();}finally{await h.close();}}
async function hashFile(file:string){const hash=createHash("sha256");let size=0;for await(const bytes of createReadStream(file)){size+=bytes.length;if(size>MAX_FILE)throw new Error("Backup file budget exceeded");hash.update(bytes);}return hash.digest("hex");}
async function describe(root:string,relative:string){
  const full=path.join(root,relative);await assertPrivatePath(root,full);const stat=await lstat(full);
  if(!stat.isFile()||stat.size>MAX_FILE)throw new Error("Unsafe or oversized backup file");
  return {path:relative,size:stat.size,sha256:await hashFile(full)};
}
async function copy(source:string,target:string,relative:string){
  const before=await describe(source,relative),destination=path.join(target,relative);
  await assertPrivatePath(target,destination);await mkdir(path.dirname(destination),{recursive:true});
  await pipeline(createReadStream(path.join(source,relative)),createWriteStream(destination,{flags:"wx"}));
  const h=await open(destination,"r+");try{await h.sync();}finally{await h.close();}
  const after=await describe(target,relative);
  if(before.size!==after.size||before.sha256!==after.sha256)throw new Error("File changed during backup copy");
  return after;
}

// Only generated, immutable committed media are copied. Staging, credentials and arbitrary files are excluded.
export async function inspectDatabase(client:Client){
  if((await client.execute("PRAGMA integrity_check")).rows.map(r=>r.integrity_check).join()!=="ok"||(await client.execute("PRAGMA foreign_key_check")).rows.length)throw new Error("Database integrity verification failed");
  const migrations=(await client.execute("SELECT name FROM _all_items_migrations ORDER BY name")).rows.map(r=>String(r.name));
  const expected=(await readdir(path.join(process.cwd(),"src/db/migrations"))).filter(n=>/^\d{4}_[a-z0-9_]+\.sql$/.test(n)).map(n=>n.slice(0,-4)).sort();
  if(JSON.stringify(migrations)!==JSON.stringify(expected))throw new Error("Incompatible database migrations; use the matching application version");
  const files:string[]=[];
  for(const row of (await client.execute("SELECT id,item_id,storage_path,thumbnail_path,source_storage_path FROM media_assets")).rows){
    const base=z.uuid().parse(row.item_id)+"/"+z.uuid().parse(row.id);
    if(row.storage_path!==base+".webp"||row.thumbnail_path!==base+"-thumb.webp"||row.source_storage_path!==null&&row.source_storage_path!==base+"-source.webp")throw new Error("Invalid media identity");
    files.push("media/items/"+base+".webp","media/items/"+base+"-thumb.webp");if(row.source_storage_path)files.push("media/items/"+base+"-source.webp");
  }
  for(const row of (await client.execute("SELECT id,collection_id,storage_path,thumbnail_path FROM collection_cover_assets")).rows){
    const base="collections/"+z.uuid().parse(row.collection_id)+"/"+z.uuid().parse(row.id);
    if(row.storage_path!==base+".webp"||row.thumbnail_path!==base+"-thumb.webp")throw new Error("Invalid cover identity");files.push("media/"+base+".webp","media/"+base+"-thumb.webp");
  }
  if((await client.execute("SELECT item_id FROM media_assets GROUP BY item_id HAVING SUM(is_primary)!=1")).rows.length)throw new Error("Invalid primary photo selection");
  if((await client.execute("SELECT c.id FROM collections c WHERE c.cover_type='item_photo' AND NOT EXISTS(SELECT 1 FROM media_assets m JOIN item_collection_memberships cm ON cm.item_id=m.item_id WHERE m.id=c.cover_media_id AND m.item_id=c.cover_item_id AND cm.collection_id=c.id)")).rows.length)throw new Error("Invalid collection cover association");
  if(files.length+1>MAX_FILES)throw new Error("Backup file budget exceeded");
  const hash=createHash("sha256");
  const tables=(await client.execute("SELECT name,sql FROM sqlite_master WHERE type='table' ORDER BY name")).rows;
  const allowed=new Set(["workspaces","items","locations","stock_entries","item_categories","media_assets","collections","collection_cover_assets","item_collection_memberships","inventory_import_operations","inventory_preferences","custom_category_presentation","item_write_receipts","_all_items_migrations","sqlite_sequence"]);
  if(tables.some(table=>!allowed.has(String(table.name))))throw new Error("Unexpected database table");
  for(const table of tables){
    const name=String(table.name);hash.update(JSON.stringify(table));
    const columns=(await client.execute(`PRAGMA table_info(${quoted(name)})`)).rows.map(r=>quoted(String(r.name)));
    const count=Number((await client.execute(`SELECT COUNT(*) AS n FROM ${quoted(name)}`)).rows[0]!.n);if(count>1_000_000)throw new Error("Backup row budget exceeded");
    for(let offset=0;offset<count;offset+=1000)hash.update(JSON.stringify((await client.execute(`SELECT * FROM ${quoted(name)} ORDER BY ${columns.join(",")} LIMIT 1000 OFFSET ${offset}`)).rows));
  }
  return {migrations,files:["all-items.db",...files.sort()],semanticHash:hash.digest("hex")};
}
async function worker(mode:string,source:string,target?:string){const {stdout}=await promisify(execFile)(process.execPath,["--import","tsx",path.join(process.cwd(),"src/backup/worker.ts"),mode,source,...(target?[target]:[])],{windowsHide:true,maxBuffer:32*1024**2,timeout:10*60_000});return JSON.parse(stdout) as Awaited<ReturnType<typeof inspectDatabase>>;}
async function inspectFile(root:string){await assertPrivatePath(root,path.join(root,"all-items.db"));return worker("inspect",root);}
async function inventoryFiles(root:string){const files:string[]=[];async function walk(relative:string){for(const item of await readdir(path.join(root,relative),{withFileTypes:true})){const next=relative?relative+"/"+item.name:item.name;await assertPrivatePath(root,path.join(root,next));if(item.isDirectory()){if(!next.startsWith("media"))throw new Error("Unexpected backup directory");await walk(next);}else if(item.isFile())files.push(next);else throw new Error("Unsupported backup entry");if(files.length>MAX_FILES+2)throw new Error("Backup file budget exceeded");}}await walk("");return files.sort();}
async function verifyContents(root:string,manifest:BackupManifest){
  let total=0;const paths=manifest.files.map(f=>f.path);
  if(new Set(paths).size!==paths.length||!paths.includes("all-items.db"))throw new Error("Duplicate or missing backup entries");
  for(const file of manifest.files){if(file.path!=="all-items.db"&&!/^media\/(items|collections)\/[a-f0-9-]{36}\/[a-f0-9-]{36}(-thumb|-source)?\.webp$/.test(file.path))throw new Error("Unsafe backup path");total+=file.size;if(total>MAX_BYTES)throw new Error("Backup size budget exceeded");const actual=await describe(root,file.path);if(actual.sha256!==file.sha256||actual.size!==file.size)throw new Error("Backup checksum mismatch");}
  const db=await inspectFile(root);if(db.semanticHash!==manifest.semanticHash||JSON.stringify(db.migrations)!==JSON.stringify(manifest.migrations)||JSON.stringify(db.files.slice().sort())!==JSON.stringify(paths.slice().sort()))throw new Error("Backup database does not match manifest");
  return total;
}
export function backupPath(directory:string,id:string){return path.join(directory,"backups","installation-"+z.uuid().parse(id));}
export async function verifyBackup(directory:string,id:string){
  const root=backupPath(directory,id);await assertPrivatePath(directory,path.join(root,"manifest.json"));
  const stat=await lstat(path.join(root,"manifest.json"));if(stat.size>32*1024**2)throw new Error("Oversized backup manifest");
  await assertPrivatePath(directory,path.join(root,"COMPLETE"));
  const text=await readFile(path.join(root,"manifest.json"),"utf8"),manifest=manifestSchema.parse(JSON.parse(text));
  if(manifest.id!==id||(await readFile(path.join(root,"COMPLETE"),"utf8"))!==digest(text))throw new Error("Incomplete backup");
  const expected=[...manifest.files.map(f=>f.path),"manifest.json","COMPLETE"].sort();
  if(JSON.stringify(await inventoryFiles(root))!==JSON.stringify(expected))throw new Error("Unexpected backup files");
  return {manifest,bytes:await verifyContents(root,manifest),path:root};
}
export async function createBackup(directory:string,options:{pinned?:boolean;fault?:Fault;afterSnapshot?:()=>Promise<void>}={}){
  await mkdir(directory,{recursive:true});
  return withInventoryOperation(directory,async()=>{
    const id=randomUUID(),stage=path.join(directory,"backups",".partial-"+id);await assertPrivatePath(directory,stage);await mkdir(stage,{recursive:true});
    await assertPrivatePath(directory,path.join(directory,"all-items.db"));
    if(!(await lstat(path.join(directory,"all-items.db"))).isFile())throw new Error("Initialized database required");
    await worker("snapshot",directory,stage);
    await options.afterSnapshot?.();
    if(options.fault==="snapshot")throw new Error("Injected backup snapshot interruption");
    const snapshot=await inspectFile(stage),files:BackupManifest["files"]=[];let total=0;
    for(const relative of snapshot.files){const file=relative==="all-items.db"?await describe(stage,relative):await copy(directory,stage,relative);files.push(file);total+=file.size;if(total>MAX_BYTES)throw new Error("Backup size budget exceeded");if(options.fault==="copy")throw new Error("Injected backup copy interruption");}
    const manifest=manifestSchema.parse({format:"all-items-installation",version:1,id,createdAt:new Date().toISOString(),application:"0.1.0",pinned:options.pinned??true,migrations:snapshot.migrations,semanticHash:snapshot.semanticHash,files});
    const text=JSON.stringify(manifest,null,2);await durable(path.join(stage,"manifest.json"),text);
    if(options.fault==="manifest")throw new Error("Injected manifest interruption");await verifyContents(stage,manifest);
    await durable(path.join(stage,"COMPLETE"),digest(text));if(options.fault==="complete")throw new Error("Injected completion interruption");
    for(let attempt=0;;attempt++){try{await rename(stage,backupPath(directory,id));break;}catch(error){if(attempt>=20||!["EPERM","EBUSY","EACCES"].includes((error as NodeJS.ErrnoException).code??""))throw error;await new Promise(resolve=>setTimeout(resolve,100));}}return verifyBackup(directory,id);
  });
}
export async function listBackups(directory:string){
  await assertPrivatePath(directory,path.join(directory,"backups"));let names:string[];try{names=await readdir(path.join(directory,"backups"));}catch(e){if((e as NodeJS.ErrnoException).code==="ENOENT")return [];throw e;}
  const results=[];for(const name of names.filter(n=>/^installation-[a-f0-9-]{36}$/.test(n))){const id=name.slice(13);try{const backup=await verifyBackup(directory,id);results.push({id,verified:true,createdAt:backup.manifest.createdAt,bytes:backup.bytes,pinned:backup.manifest.pinned});}catch{results.push({id,verified:false,createdAt:null,bytes:null,pinned:true});}}return results;
}
export async function restoreDrill(directory:string,id:string,fault?:"copy"){
  const start=Date.now(),backup=await verifyBackup(directory,id),target=await mkdtemp(path.join(os.tmpdir(),"all-items-restore-"));
  try{for(const file of backup.manifest.files){await copy(backup.path,target,file.path);if(fault)throw new Error("Injected restore interruption");}await verifyContents(target,backup.manifest);await worker("read",target);
    const report={success:true,sourceBackup:id,location:target,semanticHash:backup.manifest.semanticHash,files:backup.manifest.files.length,bytes:backup.bytes,elapsedMs:Date.now()-start};await durable(path.join(target,"restore-report.json"),JSON.stringify(report,null,2));return report;
  }catch{await durable(path.join(target,"restore-failed.json"),JSON.stringify({success:false,location:target}));throw new Error("Restore drill failed; isolated evidence retained at "+target);}
}
// Explicit opt-in only; legacy/migration backups, partial folders and pinned/manual copies are never candidates.
export async function retainBackups(directory:string,policy:{daily:number;weekly:number},apply=false){
  const keep=z.object({daily:z.number().int().min(1).max(365),weekly:z.number().int().min(1).max(520)}).parse(policy);
  return withInventoryOperation(directory,async()=>{const backups=(await listBackups(directory)).filter(b=>b.verified&&!b.pinned).sort((a,b)=>b.createdAt!.localeCompare(a.createdAt!));const days=new Set<string>(),weeks=new Set<number>(),remove:string[]=[];
    for(const backup of backups){const day=backup.createdAt!.slice(0,10),week=Math.floor(Date.parse(day)/(7*86400_000));let retain=false;if(!days.has(day)&&days.size<keep.daily){days.add(day);retain=true;}if(!weeks.has(week)&&weeks.size<keep.weekly){weeks.add(week);retain=true;}if(!retain)remove.push(backup.id);}
    if(apply)for(const id of remove){const verified=await verifyBackup(directory,id);if(verified.manifest.pinned)throw new Error("Pinned backup");const target=backupPath(directory,id);await assertPrivatePath(directory,target);await rm(target,{recursive:true});}return {apply,remove};});
}
