import { z } from "zod";
import { inventoryDatabase } from "@/items/inventories";
import type { InventoryContext } from "@/items/inventory-context";
import { canonicalCategories, categoryKeyForStoredValue } from "./categories";
import { categoryPresentations, saveCategoryPresentations } from "./inventory-presentation";
import type { Client } from "@libsql/client";

const optionalText = (max: number) => z.string().trim().max(max).optional().transform((value) => value || null);
export const itemFields = z.object({
  name: z.string().trim().min(1, "Введите название").max(160),
  model: optionalText(160),
  brand: optionalText(120),
  category: optionalText(80),
  categories: z.array(z.string().min(1).max(80)).max(20).optional(),
  categoryPresentation: categoryPresentations.optional(),
  originalMarking: optionalText(160),
  notes: optionalText(2000),
  description: optionalText(4000),
  identificationStatus: z.enum(["unknown", "user_confirmed", "source_verified"]).default("unknown"),
  trackingMode: z.enum(["unique", "bulk", "consumable"]).default("unique"),
  saleIntent: z.enum(["not_for_sale", "considering", "willing_to_sell"]).default("not_for_sale"),
  askingPrice: z.string().trim().optional().transform((value) => value ? Number(value.replace(",", ".")) : null)
    .pipe(z.number().finite().nonnegative().max(999999999).nullable()),
  askingCurrency: z.enum(["RUB", "EUR", "USD", "HUF"]).default("RUB"),
});
export type ItemFields = z.input<typeof itemFields>;

export function photoFirstItemValues(input: ItemFields, hasPhoto: boolean, fallbackName = "Unidentified item"): ItemFields {
  const suppliedName = input.name.trim();
  return {
    ...input,
    name: suppliedName || (hasPhoto ? fallbackName : ""),
    identificationStatus: suppliedName ? input.identificationStatus : "unknown",
  };
}

export const stockInput = z.array(z.object({
  location: z.string().trim().max(120).optional().transform((value) => value || ""),
  quantity: z.union([z.number(), z.string().regex(/^\d{1,7}$/).transform(Number)]).pipe(z.number().int().min(0).max(1000000)),
})).max(50);
const itemIdInput = z.string().uuid();
export type StockEntryDTO = { quantity: number; location: string | null };
export type ItemDetailDTO = {
  id: string;
  name: string;
  model: string | null;
  inventory_number: string;
  brand: string | null;
  category: string | null;
  categories: string[];
  original_marking: string | null;
  notes: string | null;
  description: string | null;
  identification_status: string;
  tracking_mode: string;
  sale_intent: string;
  asking_price_minor: number | null;
  asking_currency: string | null;
  created_at: string;
  updated_at: string;
  quantity: number;
  primary_media_id: string | null;
  stock: StockEntryDTO[];
};
const itemListFilters = z.object({
  search: z.string().trim().max(160).optional(),
  category: z.string().trim().max(80).optional(),
  status: z.enum(["unknown", "user_confirmed", "source_verified"]).optional(),
  sort: z.enum(["date", "name", "quantity"]).optional(),
  direction: z.enum(["asc", "desc"]).optional(),
  collectionId: z.string().uuid().optional(),
});

function rowObject(row: Record<string, unknown>) { return row; }

let pendingWrites: Promise<void> = Promise.resolve();
async function serializeLocalWrite<T>(operation: () => Promise<T>): Promise<T> {
  const previous = pendingWrites;
  let release!: () => void;
  pendingWrites = new Promise<void>((resolve) => { release = resolve; });
  await previous;
  try { return await operation(); }
  finally { release(); }
}

async function beginWriteTransaction(db: Awaited<ReturnType<typeof inventoryDatabase>>["db"]) {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await db.$client.transaction("write");
    } catch (error) {
      const busy = error instanceof Error && error.message.includes("SQLITE_BUSY");
      if (!busy || attempt >= 8) throw error;
      await new Promise((resolve) => setTimeout(resolve, Math.min(10 * 2 ** attempt, 250)));
    }
  }
}

export async function createItem(context: InventoryContext, input: ItemFields, stock?: unknown, attach?: (tx: Pick<Client, "execute">, id: string) => Promise<void>) {
  return serializeLocalWrite(async () => {
  const parsed = itemFields.parse(input);
  const rows = normalizedStock(stock ?? [{ location: "", quantity: parsed.trackingMode === "unique" ? 1 : 0 }], parsed.trackingMode);
  const { db, workspaceId } = await inventoryDatabase(context);
  const tx = await beginWriteTransaction(db);
  try {
    const allocated = await tx.execute({ sql: "UPDATE workspaces SET next_inventory_number = next_inventory_number + 1 WHERE id = ?", args: [workspaceId] });
    if (!allocated.rowsAffected) throw new Error("Рабочее пространство не найдено");
    const sequenceResult = await tx.execute({ sql: "SELECT next_inventory_number - 1 AS inventory_sequence FROM workspaces WHERE id = ?", args: [workspaceId] });
    const sequence = Number(sequenceResult.rows[0].inventory_sequence);
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    await tx.execute({
      sql: `INSERT INTO items (id, workspace_id, name, model, inventory_number, brand, category, original_marking, notes, description, identification_status, tracking_mode, sale_intent, asking_price_minor, asking_currency, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [id, workspaceId, parsed.name, parsed.model, `INV-${String(sequence).padStart(6, "0")}`, parsed.brand, null,
        parsed.originalMarking, parsed.notes, parsed.description, parsed.identificationStatus, parsed.trackingMode, parsed.saleIntent,
        parsed.askingPrice === null ? null : Math.round(parsed.askingPrice * 100), parsed.askingPrice !== null ? parsed.askingCurrency : null, now, now],
    });
    await replaceCategories(tx, id, parsed.categories ?? (parsed.category ? [parsed.category] : []));
    if (parsed.categoryPresentation) await saveCategoryPresentations(tx, workspaceId, parsed.categoryPresentation, canonicalCategories(parsed.categories ?? (parsed.category ? [parsed.category] : [])));
    await replaceStock(tx, id, workspaceId, rows, now);
    if (attach) await attach(tx, id);
    await tx.commit();
    return { id, inventoryNumber: `INV-${String(sequence).padStart(6, "0")}` };
  } catch (error) {
    await tx.rollback();
    throw error;
  }
  });
}

export async function listItems(context: InventoryContext, filters: { search?: string; category?: string; status?: string; sort?: string; direction?: string; collectionId?: string } = {}): Promise<Array<Record<string, unknown> & { categories: string[] }>> {
  const parsedFilters = itemListFilters.parse(filters);
  const { db, workspaceId } = await inventoryDatabase(context);
  const search = parsedFilters.search || "";
  const clauses = ["i.workspace_id = ?"];
  const args: (string | number)[] = [workspaceId];
  if (search) {
    clauses.push(`(i.name LIKE ? OR i.model LIKE ? OR i.original_marking LIKE ? OR i.brand LIKE ? OR i.notes LIKE ?
      OR i.inventory_number LIKE ? OR i.description LIKE ? OR EXISTS (SELECT 1 FROM item_categories sca WHERE sca.item_id = i.id AND sca.category LIKE ?)
      OR EXISTS (SELECT 1 FROM stock_entries ss INNER JOIN locations sl ON sl.id = ss.location_id WHERE ss.item_id = i.id AND sl.name LIKE ?)
      OR EXISTS (SELECT 1 FROM item_collection_memberships sicm INNER JOIN collections sc ON sc.id = sicm.collection_id WHERE sicm.item_id = i.id AND sc.name LIKE ?))`);
    const match = `%${search}%`; args.push(match, match, match, match, match, match, match, match, match, match);
  }
  if (parsedFilters.category) {
    clauses.push("EXISTS (SELECT 1 FROM item_categories ic WHERE ic.item_id = i.id AND ic.category = ?)");
    args.push(categoryKeyForStoredValue(parsedFilters.category) ?? parsedFilters.category);
  }
  if (parsedFilters.status) { clauses.push("i.identification_status = ?"); args.push(parsedFilters.status); }
  if (parsedFilters.collectionId) {
    clauses.push("EXISTS (SELECT 1 FROM item_collection_memberships icm INNER JOIN collections c ON c.id = icm.collection_id WHERE icm.item_id = i.id AND c.id = ? AND c.workspace_id = i.workspace_id)");
    args.push(parsedFilters.collectionId);
  }
  const order = parsedFilters.sort === "name" ? "i.name" : parsedFilters.sort === "quantity" ? "quantity" : "i.created_at";
  const direction = parsedFilters.direction ? parsedFilters.direction === "asc" ? "ASC" : "DESC" : parsedFilters.sort === "name" ? "ASC" : "DESC";
  const result = await db.$client.execute({
    sql: `SELECT i.id, i.name, i.model, i.brand, (SELECT json_group_array(category) FROM (SELECT category FROM item_categories WHERE item_id=i.id ORDER BY category)) AS categories_json, i.original_marking, i.inventory_number, i.identification_status, i.tracking_mode, i.created_at AS createdAt, COALESCE(SUM(s.quantity), 0) AS quantity, GROUP_CONCAT(DISTINCT l.name) AS locations,
                 (SELECT m.id FROM media_assets m WHERE m.item_id = i.id AND m.is_primary = 1 LIMIT 1) AS primary_media_id
          FROM items i LEFT JOIN stock_entries s ON s.item_id = i.id LEFT JOIN locations l ON l.id = s.location_id
          WHERE ${clauses.join(" AND ")} GROUP BY i.id ORDER BY ${order} ${direction}, i.id ASC`, args,
  });
  return result.rows.map((row) => { const categories = JSON.parse(String(row.categories_json)) as string[]; return { ...rowObject(row as Record<string, unknown>), categories, category: categories[0] ?? null }; });
}

export async function listCategoryValues(context: InventoryContext, collectionIdValue?: unknown) {
  const collectionId = collectionIdValue === undefined ? undefined : z.string().uuid().parse(collectionIdValue);
  const { db, workspaceId } = await inventoryDatabase(context);
  const membership = collectionId
    ? "AND EXISTS (SELECT 1 FROM item_collection_memberships cm WHERE cm.item_id = i.id AND cm.collection_id = ?)"
    : "";
  const args = collectionId ? [workspaceId, collectionId] : [workspaceId];
  const result = await db.$client.execute({
    sql: "SELECT DISTINCT ic.category FROM item_categories ic JOIN items i ON i.id=ic.item_id WHERE i.workspace_id = ? " + membership + " ORDER BY lower(ic.category), ic.category",
    args,
  });
  return result.rows.map((row) => String(row.category));
}

export async function countItems(context: InventoryContext) {
  const { db, workspaceId } = await inventoryDatabase(context);
  const result = await db.$client.execute({ sql: "SELECT COUNT(*) AS count FROM items WHERE workspace_id = ?", args: [workspaceId] });
  return Number(result.rows[0]?.count ?? 0);
}

export async function getItem(context: InventoryContext, id: string): Promise<ItemDetailDTO | null> {
  id = itemIdInput.parse(id);
  const { db, workspaceId } = await inventoryDatabase(context);
  const result = await db.$client.execute({
    sql: `SELECT i.id, i.name, i.model, i.inventory_number, i.brand, (SELECT json_group_array(category) FROM (SELECT category FROM item_categories WHERE item_id=i.id ORDER BY category)) AS categories_json, i.original_marking,
                 i.notes, i.description, i.identification_status, i.tracking_mode, i.sale_intent,
                 i.asking_price_minor, i.asking_currency, i.created_at, i.updated_at,
                 COALESCE(SUM(s.quantity), 0) AS quantity,
                 (SELECT m.id FROM media_assets m WHERE m.item_id = i.id AND m.is_primary = 1 LIMIT 1) AS primary_media_id
          FROM items i LEFT JOIN stock_entries s ON s.item_id = i.id WHERE i.workspace_id = ? AND i.id = ? GROUP BY i.id`,
    args: [workspaceId, id],
  });
  if (!result.rows.length) return null;
  const stock = await db.$client.execute({ sql: `SELECT s.quantity, l.name AS location FROM stock_entries s LEFT JOIN locations l ON l.id = s.location_id WHERE s.item_id = ? ORDER BY l.name`, args: [id] });
  const row = result.rows[0];
  const stockRows: StockEntryDTO[] = stock.rows.map((stockRow) => ({
    quantity: Number(stockRow.quantity),
    location: stockRow.location == null ? null : String(stockRow.location),
  }));
  return {
    id: String(row.id),
    name: String(row.name),
    model: row.model == null ? null : String(row.model),
    inventory_number: String(row.inventory_number),
    brand: row.brand == null ? null : String(row.brand),
    category: (JSON.parse(String(row.categories_json)) as string[])[0] ?? null,
    categories: JSON.parse(String(row.categories_json)) as string[],
    original_marking: row.original_marking == null ? null : String(row.original_marking),
    notes: row.notes == null ? null : String(row.notes),
    description: row.description == null ? null : String(row.description),
    identification_status: String(row.identification_status),
    tracking_mode: String(row.tracking_mode),
    sale_intent: String(row.sale_intent),
    asking_price_minor: row.asking_price_minor == null ? null : Number(row.asking_price_minor),
    asking_currency: row.asking_currency == null ? null : String(row.asking_currency),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
    quantity: Number(row.quantity),
    primary_media_id: row.primary_media_id == null ? null : String(row.primary_media_id),
    stock: stockRows,
  };
}

type StockValues = ReturnType<typeof stockInput.parse>;
export function normalizedStock(input: unknown, mode: string): StockValues {
  const rows = stockInput.parse(input).filter(entry => entry.location || entry.quantity > 0);
  const names = rows.map(entry => entry.location.toLocaleLowerCase("ru-RU"));
  if (new Set(names).size !== names.length) throw new Error("Duplicate stock locations");
  if (mode === "unique" && (rows.length !== 1 || rows[0]!.quantity !== 1)) throw new Error("Single item requires one unit and one location");
  return rows;
}

async function replaceCategories(tx: Awaited<ReturnType<typeof beginWriteTransaction>>, id: string, values: string[]) {
  const parsed = z.array(z.string().min(1).max(80)).max(20).parse(values);
  const categories = canonicalCategories(parsed);
  await tx.execute({ sql: "DELETE FROM item_categories WHERE item_id = ?", args: [id] });
  for (const category of categories) await tx.execute({ sql: "INSERT INTO item_categories (item_id,category) VALUES (?,?)", args: [id,category] });
}

async function replaceStock(tx: Awaited<ReturnType<typeof beginWriteTransaction>>, id: string, workspaceId: string, rows: StockValues, now: string) {
  const current = await tx.execute({ sql: "SELECT id,location_id,quantity FROM stock_entries WHERE item_id=?", args: [id] });
  const retained = new Set<string>();
  const desired = rows.length ? rows : [{ location: "", quantity: 0 }];
  for (const entry of desired) {
    let locationId: string | null = null;
    if (entry.location) {
      const found = await tx.execute({ sql: "SELECT id FROM locations WHERE workspace_id = ? AND name = ?", args: [workspaceId,entry.location] });
      locationId = found.rows.length ? String(found.rows[0]!.id) : crypto.randomUUID();
      if (!found.rows.length) await tx.execute({ sql: "INSERT INTO locations (id,workspace_id,name,created_at) VALUES (?,?,?,?)", args: [locationId,workspaceId,entry.location,now] });
    }
    const existing = current.rows.find(row => row.location_id === locationId);
    if (existing) {
      retained.add(String(existing.id));
      if (Number(existing.quantity) !== entry.quantity) await tx.execute({ sql: "UPDATE stock_entries SET quantity=?,updated_at=? WHERE id=?", args: [entry.quantity,now,String(existing.id)] });
    } else {
      const stockId=crypto.randomUUID(); retained.add(stockId);
      await tx.execute({ sql: "INSERT INTO stock_entries (id,item_id,location_id,quantity,created_at,updated_at) VALUES (?,?,?,?,?,?)", args: [stockId,id,locationId,entry.quantity,now,now] });
    }
  }
  for (const row of current.rows) if (!retained.has(String(row.id))) await tx.execute({sql:"DELETE FROM stock_entries WHERE id=?",args:[String(row.id)]});

}

export async function updateItem(context: InventoryContext, id: string, input: ItemFields, stock?: unknown) {
  id = itemIdInput.parse(id);
  const parsed = itemFields.parse(input);
  return serializeLocalWrite(async () => {
    const { db, workspaceId } = await inventoryDatabase(context);
    const tx = await beginWriteTransaction(db);
    try {
      const existing = await tx.execute({ sql: "SELECT id FROM items WHERE id=? AND workspace_id=?", args: [id,workspaceId] });
      if (!existing.rows.length) throw new Error("Item not found");
      const current = await tx.execute({ sql: "SELECT s.quantity,l.name AS location FROM stock_entries s LEFT JOIN locations l ON l.id=s.location_id WHERE s.item_id=?", args: [id] });
      const rows = normalizedStock(stock ?? current.rows.map(row => ({quantity: Number(row.quantity), location: String(row.location ?? "")})), parsed.trackingMode);
      const now = new Date().toISOString();
      await tx.execute({
        sql: `UPDATE items SET name=?,model=?,brand=?,original_marking=?,notes=?,description=?,identification_status=?,tracking_mode=?,sale_intent=?,asking_price_minor=?,asking_currency=?,updated_at=? WHERE id=? AND workspace_id=?`,
        args: [parsed.name,parsed.model,parsed.brand,parsed.originalMarking,parsed.notes,parsed.description,parsed.identificationStatus,parsed.trackingMode,parsed.saleIntent,parsed.askingPrice === null ? null : Math.round(parsed.askingPrice*100),parsed.askingPrice !== null ? parsed.askingCurrency : null,now,id,workspaceId],
      });
      if (parsed.categories !== undefined || input.category !== undefined) await replaceCategories(tx,id,parsed.categories ?? (parsed.category ? [parsed.category] : []));
      if (parsed.categoryPresentation) await saveCategoryPresentations(tx, workspaceId, parsed.categoryPresentation, canonicalCategories(parsed.categories ?? (parsed.category ? [parsed.category] : [])));
      if (stock !== undefined) await replaceStock(tx,id,workspaceId,rows,now);
      await tx.commit();
    } catch (error) { await tx.rollback(); throw error; }
  });
}

export async function saveStock(context: InventoryContext, id: string, input: unknown) {
  id = itemIdInput.parse(id);
  return serializeLocalWrite(async () => {
    const { db, workspaceId } = await inventoryDatabase(context);
    const tx = await beginWriteTransaction(db);
    try {
      const item = await tx.execute({sql:"SELECT tracking_mode FROM items WHERE id=? AND workspace_id=?",args:[id,workspaceId]});
      if (!item.rows.length) throw new Error("Item not found");
      await replaceStock(tx,id,workspaceId,normalizedStock(input,String(item.rows[0]!.tracking_mode)),new Date().toISOString());
      await tx.commit();
    } catch (error) { await tx.rollback(); throw error; }
  });
}

export async function deleteItem(context: InventoryContext, id: string) {
  id = itemIdInput.parse(id);
  const { db, workspaceId } = await inventoryDatabase(context);
  const tx = await beginWriteTransaction(db);
  try {
    const item = await tx.execute({ sql: "SELECT id FROM items WHERE id=? AND workspace_id=?", args: [id, workspaceId] });
    if (!item.rows.length) { await tx.commit(); return; }
    await tx.execute({ sql: "DELETE FROM stock_entries WHERE item_id = ?", args: [id] });
    await tx.execute({ sql: "DELETE FROM items WHERE id = ? AND workspace_id = ?", args: [id, workspaceId] });
    await tx.commit();
  } catch (error) { await tx.rollback(); throw error; }
}
