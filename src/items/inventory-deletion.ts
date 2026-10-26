import { createClient, type Client } from "@libsql/client";
import { createHash,randomUUID } from "node:crypto";
import { mkdir,open,readFile,readdir,rm } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { z } from "zod";
import { dataDirectory,getDatabase } from "@/db/client";
import { createMigrationBackup } from "@/db/backup";
import { assertPrivatePath } from "@/media/private-paths";
import { inventoryContextSchema,type InventoryContext } from "./inventory-context";
import { withInventoryOperation } from "./operation-lock";

export class InventoryDeletionError extends Error {
  constructor(public code:"confirmation"|"changed"|"not_found") {super(code);}
}
type Executor=Pick<Client,"execute">;
const journalSchema=z.object({version:z.literal(1),operationId:z.uuid(),workspaceId:z.uuid(),files:z.array(z.string().regex(/^media\/(?:items|collections)\/[0-9a-f-]{36}\/[0-9a-f-]{36}(?:-thumb|-source)?\.webp$/)),backup:z.string()});

async function ownedRows(client:Executor,id:string) {
  const queries:Record<string,string>={
    workspaces:"SELECT * FROM workspaces WHERE id=? ORDER BY id",
    items:"SELECT * FROM items WHERE workspace_id=? ORDER BY id",
    locations:"SELECT * FROM locations WHERE workspace_id=? ORDER BY id",
    collections:"SELECT * FROM collections WHERE workspace_id=? ORDER BY id",
    stock_entries:"SELECT s.* FROM stock_entries s JOIN items i ON i.id=s.item_id WHERE i.workspace_id=? ORDER BY s.id",
    item_categories:"SELECT c.* FROM item_categories c JOIN items i ON i.id=c.item_id WHERE i.workspace_id=? ORDER BY c.item_id,c.category",
    media_assets:"SELECT m.* FROM media_assets m JOIN items i ON i.id=m.item_id WHERE i.workspace_id=? ORDER BY m.id",
    item_collection_memberships:"SELECT m.* FROM item_collection_memberships m JOIN collections c ON c.id=m.collection_id WHERE c.workspace_id=? ORDER BY m.id",
    collection_cover_assets:"SELECT a.* FROM collection_cover_assets a JOIN collections c ON c.id=a.collection_id WHERE c.workspace_id=? ORDER BY a.id",
    inventory_import_operations:"SELECT * FROM inventory_import_operations WHERE workspace_id=? ORDER BY id",
  };
  const rows:Record<string,Array<Record<string,unknown>>>={};
  for(const[table,sql]of Object.entries(queries))rows[table]=(await client.execute({sql,args:[id]})).rows as unknown as Array<Record<string,unknown>>;
  return rows;
}

function selectedFiles(rows:Awaited<ReturnType<typeof ownedRows>>) {
  const files:string[]=[];
  for(const asset of rows.media_assets!) {
    const base=`${z.uuid().parse(asset.item_id)}/${z.uuid().parse(asset.id)}`;
    if(asset.storage_path!==`${base}.webp`||asset.thumbnail_path!==`${base}-thumb.webp`||asset.source_storage_path!==null&&asset.source_storage_path!==`${base}-source.webp`)throw new Error("Invalid deletion media identity");
    files.push(`media/items/${base}.webp`,`media/items/${base}-thumb.webp`);
    if(asset.source_storage_path)files.push(`media/items/${base}-source.webp`);
  }
  for(const asset of rows.collection_cover_assets!) {
    const base=`collections/${z.uuid().parse(asset.collection_id)}/${z.uuid().parse(asset.id)}`;
    if(asset.storage_path!==`${base}.webp`||asset.thumbnail_path!==`${base}-thumb.webp`)throw new Error("Invalid deletion cover identity");
    files.push(`media/${base}.webp`,`media/${base}-thumb.webp`);
  }
  return files;
}

async function cleanFiles(client:Executor,directory:string,files:string[]) {
  for(const relative of files) {
    const referenced=await client.execute({sql:"SELECT 1 FROM media_assets WHERE ('media/items/'||storage_path)=? OR ('media/items/'||thumbnail_path)=? OR ('media/items/'||source_storage_path)=? UNION ALL SELECT 1 FROM collection_cover_assets WHERE ('media/'||storage_path)=? OR ('media/'||thumbnail_path)=? LIMIT 1",args:[relative,relative,relative,relative,relative]});
    if(referenced.rows.length)throw new Error("Deletion cleanup refuses referenced media");
    const file=path.resolve(directory,relative);await assertPrivatePath(directory,file);await rm(file,{force:true});
  }
}

export async function recoverInventoryDeletions(client:Client,directory:string) {
  return withInventoryOperation(directory,async()=>{
    const journals=path.join(directory,"deletions");await assertPrivatePath(directory,journals);
    let entries;try{entries=await readdir(journals,{withFileTypes:true});}catch(error){if(error instanceof Error && "code" in error && error.code==="ENOENT")return;throw error;}
    for(const entry of entries) {
      if(!entry.isFile()||!/^[0-9a-f-]{36}\.json$/.test(entry.name))continue;
      const file=path.join(journals,entry.name);await assertPrivatePath(directory,file);
      const journal=journalSchema.parse(JSON.parse(await readFile(file,"utf8")));
      if(entry.name!==`${journal.operationId}.json`)throw new Error("Invalid deletion recovery identity");
      const exists=(await client.execute({sql:"SELECT id FROM workspaces WHERE id=?",args:[journal.workspaceId]})).rows.length>0;
      if(!exists)await cleanFiles(client,directory,journal.files);
      await rm(file);
    }
  });
}

export async function deleteInventory(context:InventoryContext,confirmation:unknown,storage?:{client:Client;directory:string},fault?:"transaction"|"cleanup") {
  const {workspaceId}=inventoryContextSchema.parse(context);
  const confirmed=z.string().max(120).parse(confirmation);
  const directory=storage?.directory??dataDirectory(),client=storage?.client??(await getDatabase()).$client;
  return withInventoryOperation(directory,async()=>{
    const initial=await ownedRows(client,workspaceId);
    if(!initial.workspaces!.length)throw new InventoryDeletionError("not_found");
    if((initial.items!.length||initial.collections!.length)&&confirmed!==initial.workspaces![0]!.name)throw new InventoryDeletionError("confirmation");
    await assertPrivatePath(directory,path.join(directory,"backups"));
    const backup=await createMigrationBackup(client,directory);
    const saved=createClient({url:pathToFileURL(path.join(backup,"all-items.db")).href});
    let snapshot:Awaited<ReturnType<typeof ownedRows>>;
    try{snapshot=await ownedRows(saved,workspaceId);}finally{await saved.close();}
    if((snapshot.items!.length||snapshot.collections!.length)&&confirmed!==snapshot.workspaces![0]!.name)throw new InventoryDeletionError("confirmation");
    const hashes=JSON.parse(await readFile(path.join(backup,"verified-sha256.json"),"utf8")) as Record<string,string>;
    const files=selectedFiles(snapshot);
    const operationId=randomUUID(),journals=path.join(directory,"deletions"),journal=path.join(journals,`${operationId}.json`);
    await assertPrivatePath(directory,journal);await mkdir(journals,{recursive:true});
    const tx=await client.transaction("write");
    let written=false;
    try {
      if(JSON.stringify(await ownedRows(tx,workspaceId))!==JSON.stringify(snapshot))throw new InventoryDeletionError("changed");
      for(const relative of files) {
        const file=path.join(directory,relative);await assertPrivatePath(directory,file);
        if(createHash("sha256").update(await readFile(file)).digest("hex")!==hashes[relative])throw new InventoryDeletionError("changed");
      }
      const handle=await open(journal,"wx");written=true;
      try{await handle.writeFile(JSON.stringify({version:1,operationId,workspaceId,files,backup:path.basename(backup)}));await handle.sync();}finally{await handle.close();}
      await tx.execute({sql:"DELETE FROM collections WHERE workspace_id=?",args:[workspaceId]});
      await tx.execute({sql:"DELETE FROM items WHERE workspace_id=?",args:[workspaceId]});
      await tx.execute({sql:"DELETE FROM locations WHERE workspace_id=?",args:[workspaceId]});
      await tx.execute({sql:"DELETE FROM workspaces WHERE id=?",args:[workspaceId]});
      if(fault==="transaction")throw new Error("Simulated inventory deletion failure");
      if((await tx.execute("PRAGMA foreign_key_check")).rows.length)throw new Error("Inventory deletion relationship check failed");
      await tx.commit();
    } catch(error){await tx.rollback();if(written)await rm(journal,{force:true});throw error;}
    let cleanupPending=false;
    try{if(fault==="cleanup")throw new Error("Simulated cleanup interruption");await cleanFiles(client,directory,files);await rm(journal);}
    catch{cleanupPending=true;console.error("Deleted inventory media cleanup deferred until startup");}
    return {backup,cleanupPending};
  });
}
