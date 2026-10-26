import { z } from "zod";
import { getDatabase } from "@/db/client";
import { inventoryContextSchema, type InventoryContext } from "./inventory-context";

export type Inventory = InventoryContext & { name: string; createdAt: string; nextInventoryNumber: number };
export const inventoryName = z.string().trim().min(1).max(120);

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
  const db = await getDatabase();
  const workspaceId = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  await db.$client.execute({ sql: "INSERT INTO workspaces(id,name,created_at,next_inventory_number) VALUES(?,?,?,1)", args: [workspaceId,name,createdAt] });
  return { workspaceId, name, createdAt, nextInventoryNumber: 1 };
}

export async function renameInventory(context: InventoryContext, value: unknown) {
  const name = inventoryName.parse(value);
  const { db, workspaceId } = await inventoryDatabase(context);
  const result = await db.$client.execute({ sql: "UPDATE workspaces SET name=? WHERE id=?", args: [name,workspaceId] });
  if (!result.rowsAffected) throw new Error("Inventory not found");
}

export async function inventoryCounts(context: InventoryContext) {
  const { db, workspaceId } = await inventoryDatabase(context);
  const result = await db.$client.execute({ sql: "SELECT (SELECT COUNT(*) FROM items WHERE workspace_id=?) AS items,(SELECT COUNT(*) FROM collections WHERE workspace_id=?) AS collections", args: [workspaceId,workspaceId] });
  return { items: Number(result.rows[0]!.items), collections: Number(result.rows[0]!.collections) };
}
