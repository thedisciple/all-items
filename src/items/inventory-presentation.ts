import { z } from "zod";
import type { Client } from "@libsql/client";
import { inventoryDatabase } from "./inventories";
import { categoryKeyForStoredValue } from "./categories";
import type { InventoryContext } from "./inventory-context";

export const inventorySort = z.enum(["date", "name", "quantity"]);
export const portablePreferences = z.object({ version: z.literal(1), sort: inventorySort }).strict();
export const categoryPresentation = z.object({ category: z.string().min(1).max(80).refine(value => value.trim() === value && !categoryKeyForStoredValue(value)), emoji: z.string().trim().min(1).max(32).refine(value => /\p{Extended_Pictographic}|\p{Regional_Indicator}/u.test(value)) }).strict();
export const categoryPresentations = z.array(categoryPresentation).max(2000).refine(values => new Set(values.map(value => value.category)).size === values.length);
export type Presentation = z.infer<typeof categoryPresentation>;

export async function getInventoryPresentation(context: InventoryContext) {
  const { db, workspaceId } = await inventoryDatabase(context);
  const [preferences, categories] = await Promise.all([
    db.$client.execute({ sql: "SELECT version, sort FROM inventory_preferences WHERE workspace_id=?", args: [workspaceId] }),
    db.$client.execute({ sql: "SELECT category, emoji FROM custom_category_presentation WHERE workspace_id=? ORDER BY category", args: [workspaceId] }),
  ]);
  return { preferences: portablePreferences.parse(preferences.rows[0] ?? { version: 1, sort: "date" }), categories: categoryPresentations.parse(categories.rows) };
}

export async function setInventorySort(context: InventoryContext, value: unknown) {
  const sort = inventorySort.parse(value);
  const { db, workspaceId } = await inventoryDatabase(context);
  if (sort === "date") await db.$client.execute({ sql: "DELETE FROM inventory_preferences WHERE workspace_id=?", args: [workspaceId] });
  else await db.$client.execute({ sql: "INSERT INTO inventory_preferences(workspace_id,version,sort) VALUES(?,1,?) ON CONFLICT(workspace_id) DO UPDATE SET version=1,sort=excluded.sort", args: [workspaceId, sort] });
}

export async function saveCategoryPresentations(tx: Pick<Client, "execute">, workspaceId: string, values: unknown, selected: string[]) {
  for (const value of categoryPresentations.parse(values)) {
    if (!selected.includes(value.category)) throw new Error("Category presentation must refer to a selected category");
    await tx.execute({ sql: "INSERT INTO custom_category_presentation(workspace_id,category,emoji) VALUES(?,?,?) ON CONFLICT(workspace_id,category) DO UPDATE SET emoji=excluded.emoji", args: [workspaceId, value.category, value.emoji] });
  }
}
