import { z } from "zod";
import { getDatabase } from "@/db/client";
import { inventoryContextSchema, type InventoryContext } from "./inventory-context";
import { normalizedInventoryName } from "./inventory-names";
import type { Client } from "@libsql/client";

export type Inventory = InventoryContext & { name: string; createdAt: string; nextInventoryNumber: number };
export const inventoryName = z.string().trim().min(1).max(120);
export class InventoryNameConflict extends Error { constructor(){super("Inventory name already exists");} }

// Call inside a SQLite write transaction so concurrent writers cannot both pass.
export async function assertUniqueInventoryName(client:Pick<Client,"execute">,name:string,exceptId?:string) {
  const rows=(await client.execute("SELECT id,name FROM workspaces")).rows;
  if(rows.some(row=>String(row.id)!==exceptId&&normalizedInventoryName(String(row.name))===normalizedInventoryName(name)))throw new InventoryNameConflict();
}

let pendingNameWrites:Promise<void>=Promise.resolve();
// Serialize local name writes; BEGIN IMMEDIATE also excludes concurrent processes.
async function inventoryNameWrite<T>(work:(tx:Pick<Client,"execute">)=>Promise<T>):Promise<T> {
  const previous=pendingNameWrites;let release!:()=>void;
  pendingNameWrites=new Promise(resolve=>{release=resolve;});await previous;
  try {
    const client=(await getDatabase()).$client;
    for(let attempt=0;;attempt++) {
      try {
        const tx=await client.transaction("write");
        try { const result=await work(tx);await tx.commit();return result; }
        catch(error){await tx.rollback();throw error;}
      }catch(error){
        if(!(error instanceof Error && error.message.includes("SQLITE_BUSY")) || attempt>=8)throw error;
        await new Promise(resolve=>setTimeout(resolve,Math.min(10*2**attempt,250)));
      }
    }
  } finally { release(); }
}

export async function resolveInventory(value: unknown): Promise<Inventory> {
  const workspaceId = z.uuid().parse(value);
  const db = await getDatabase();
  const result = await db.$client.execute({ sql: "SELECT * FROM workspaces WHERE id=?", args: [workspaceId] });
  if (!result.rows.length) throw new Error("Inventory not found");
  const row = result.rows[0]!;
  return { workspaceId, name: String(row.name), createdAt: String(row.created_at), nextInventoryNumber: Number(row.next_inventory_number) };
}

export async function inventoryDatabase(context: InventoryContext) {
  const { workspaceId } = inventoryContextSchema.parse(context);
  await resolveInventory(workspaceId);
  return { db: await getDatabase(), workspaceId };
}

export async function listInventories(): Promise<Inventory[]> {
  const db = await getDatabase();
  const result = await db.$client.execute("SELECT * FROM workspaces ORDER BY created_at,id");
  return result.rows.map(row => ({ workspaceId: String(row.id), name: String(row.name), createdAt: String(row.created_at), nextInventoryNumber: Number(row.next_inventory_number) }));
}

export async function createInventory(value: unknown): Promise<Inventory> {
  const name = inventoryName.parse(value);
  const workspaceId = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  await inventoryNameWrite(async tx=>{
    await assertUniqueInventoryName(tx,name);
    await tx.execute({ sql: "INSERT INTO workspaces(id,name,created_at,next_inventory_number) VALUES(?,?,?,1)", args: [workspaceId,name,createdAt] });
  });
  return { workspaceId, name, createdAt, nextInventoryNumber: 1 };
}

export async function renameInventory(context: InventoryContext, value: unknown) {
  const name = inventoryName.parse(value);
  const { workspaceId } = inventoryContextSchema.parse(context);
  await inventoryNameWrite(async tx=>{
    const existing=await tx.execute({sql:"SELECT name FROM workspaces WHERE id=?",args:[workspaceId]});
    if(!existing.rows.length)throw new Error("Inventory not found");
    if(String(existing.rows[0]!.name)!==name) {
      await assertUniqueInventoryName(tx,name,workspaceId);
      await tx.execute({ sql: "UPDATE workspaces SET name=? WHERE id=?", args: [name,workspaceId] });
    }
  });
}

export async function inventoryCounts(context: InventoryContext) {
  const { db, workspaceId } = await inventoryDatabase(context);
  const result = await db.$client.execute({ sql: "SELECT (SELECT COUNT(*) FROM items WHERE workspace_id=?) AS items,(SELECT COUNT(*) FROM collections WHERE workspace_id=?) AS collections", args: [workspaceId,workspaceId] });
  return { items: Number(result.rows[0]!.items), collections: Number(result.rows[0]!.collections) };
}
