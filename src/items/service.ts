import { z } from "zod";
import { initializeWorkspace } from "@/db/client";

const optionalText = (max: number) => z.string().trim().max(max).optional().transform((value) => value || null);
export const itemFields = z.object({
  name: z.string().trim().min(1, "Введите название").max(160),
  model: optionalText(160),
  brand: optionalText(120),
  category: optionalText(80),
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

export function photoFirstItemValues(input: ItemFields, hasPhoto: boolean): ItemFields {
  const suppliedName = input.name.trim();
  return {
    ...input,
    name: suppliedName || (hasPhoto ? "Неизвестный предмет" : ""),
    identificationStatus: suppliedName ? input.identificationStatus : "unknown",
  };
}

export const stockInput = z.array(z.object({
  location: z.string().trim().max(120).optional().transform((value) => value || ""),
  quantity: z.coerce.number().int().min(0).max(1000000),
})).max(50);
const itemIdInput = z.string().uuid();
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

async function beginWriteTransaction(db: Awaited<ReturnType<typeof initializeWorkspace>>["db"]) {
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

export async function createItem(input: ItemFields) {
  return serializeLocalWrite(async () => {
  const parsed = itemFields.parse(input);
  const { db, workspaceId } = await initializeWorkspace();
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
      args: [id, workspaceId, parsed.name, parsed.model, `INV-${String(sequence).padStart(6, "0")}`, parsed.brand, parsed.category,
        parsed.originalMarking, parsed.notes, parsed.description, parsed.identificationStatus, parsed.trackingMode, parsed.saleIntent,
        parsed.askingPrice === null ? null : Math.round(parsed.askingPrice * 100), parsed.askingPrice !== null ? parsed.askingCurrency : null, now, now],
    });
    await tx.execute({ sql: "INSERT INTO stock_entries (id, item_id, location_id, quantity, created_at, updated_at) VALUES (?, ?, NULL, ?, ?, ?)", args: [crypto.randomUUID(), id, parsed.trackingMode === "unique" ? 1 : 0, now, now] });
    await tx.commit();
    return { id, inventoryNumber: `INV-${String(sequence).padStart(6, "0")}` };
  } catch (error) {
    await tx.rollback();
    throw error;
  }
  });
}

export async function listItems(filters: { search?: string; category?: string; status?: string; sort?: string; direction?: string; collectionId?: string } = {}) {
  const parsedFilters = itemListFilters.parse(filters);
  const { db, workspaceId } = await initializeWorkspace();
  const search = parsedFilters.search || "";
  const clauses = ["i.workspace_id = ?"];
  const args: (string | number)[] = [workspaceId];
  if (search) {
    clauses.push("(i.name LIKE ? OR i.model LIKE ? OR i.original_marking LIKE ? OR i.brand LIKE ? OR i.notes LIKE ?)");
    const match = `%${search}%`; args.push(match, match, match, match, match);
  }
  if (parsedFilters.category) { clauses.push("i.category = ?"); args.push(parsedFilters.category); }
  if (parsedFilters.status) { clauses.push("i.identification_status = ?"); args.push(parsedFilters.status); }
  if (parsedFilters.collectionId) {
    clauses.push("EXISTS (SELECT 1 FROM item_collection_memberships icm INNER JOIN collections c ON c.id = icm.collection_id WHERE icm.item_id = i.id AND c.id = ? AND c.workspace_id = i.workspace_id)");
    args.push(parsedFilters.collectionId);
  }
  const order = parsedFilters.sort === "name" ? "i.name" : parsedFilters.sort === "quantity" ? "quantity" : "i.created_at";
  const direction = parsedFilters.direction === "asc" ? "ASC" : "DESC";
  const result = await db.$client.execute({
    sql: `SELECT i.id, i.name, i.model, i.brand, i.category, i.original_marking, i.inventory_number, i.identification_status, i.tracking_mode, i.created_at AS createdAt, COALESCE(SUM(s.quantity), 0) AS quantity, GROUP_CONCAT(DISTINCT l.name) AS locations,
                 (SELECT m.id FROM media_assets m WHERE m.item_id = i.id AND m.is_primary = 1 LIMIT 1) AS primary_media_id
          FROM items i LEFT JOIN stock_entries s ON s.item_id = i.id LEFT JOIN locations l ON l.id = s.location_id
          WHERE ${clauses.join(" AND ")} GROUP BY i.id ORDER BY ${order} ${direction}, i.id ASC`, args,
  });
  return result.rows.map((row) => rowObject(row as Record<string, unknown>));
}

export async function getItem(id: string): Promise<(Record<string, unknown> & { stock: Array<{ quantity: number; location: string | null }> }) | null> {
  id = itemIdInput.parse(id);
  const { db, workspaceId } = await initializeWorkspace();
  const result = await db.$client.execute({
    sql: `SELECT i.*, COALESCE(SUM(s.quantity), 0) AS quantity,
                 (SELECT m.id FROM media_assets m WHERE m.item_id = i.id AND m.is_primary = 1 LIMIT 1) AS primary_media_id
          FROM items i LEFT JOIN stock_entries s ON s.item_id = i.id WHERE i.workspace_id = ? AND i.id = ? GROUP BY i.id`,
    args: [workspaceId, id],
  });
  if (!result.rows.length) return null;
  const stock = await db.$client.execute({ sql: `SELECT s.quantity, l.name AS location FROM stock_entries s LEFT JOIN locations l ON l.id = s.location_id WHERE s.item_id = ? ORDER BY l.name`, args: [id] });
  return { ...rowObject(result.rows[0] as Record<string, unknown>), stock: stock.rows as unknown as Array<{ quantity: number; location: string | null }> };
}

export async function updateItem(id: string, input: ItemFields) {
  id = itemIdInput.parse(id);
  const parsed = itemFields.parse(input);
  const { db, workspaceId } = await initializeWorkspace();
  if (parsed.trackingMode === "unique") {
    const stock = await db.$client.execute({ sql: "SELECT COALESCE(SUM(quantity), 0) AS quantity FROM stock_entries WHERE item_id = ?", args: [id] });
    if (Number(stock.rows[0]?.quantity ?? 0) !== 1) throw new Error("Для уникальной вещи количество должно быть равно 1");
  }
  const result = await db.$client.execute({
    sql: `UPDATE items SET name=?, model=?, brand=?, category=?, original_marking=?, notes=?, description=?, identification_status=?, tracking_mode=?, sale_intent=?, asking_price_minor=?, asking_currency=?, updated_at=? WHERE id=? AND workspace_id=?`,
    args: [parsed.name, parsed.model, parsed.brand, parsed.category, parsed.originalMarking, parsed.notes, parsed.description,
      parsed.identificationStatus, parsed.trackingMode, parsed.saleIntent, parsed.askingPrice === null ? null : Math.round(parsed.askingPrice * 100),
      parsed.askingPrice !== null ? parsed.askingCurrency : null, new Date().toISOString(), id, workspaceId],
  });
  if (!result.rowsAffected) throw new Error("Вещь не найдена");
}

export async function saveStock(id: string, input: unknown) {
  id = itemIdInput.parse(id);
  const parsed = stockInput.parse(input);
  const item = await getItem(id);
  if (!item) throw new Error("Вещь не найдена");
  const total = parsed.reduce((sum, entry) => sum + entry.quantity, 0);
  if ((item as Record<string, unknown>).tracking_mode === "unique" && total !== 1) throw new Error("Для уникальной вещи количество должно быть равно 1");
  const nonEmpty = parsed.filter((entry) => entry.location || entry.quantity > 0);
  const names = nonEmpty.map((entry) => entry.location.toLocaleLowerCase("ru-RU"));
  if (new Set(names).size !== names.length) throw new Error("Укажите каждое место хранения один раз");
  const { db, workspaceId } = await initializeWorkspace();
  const tx = await beginWriteTransaction(db);
  try {
    await tx.execute({ sql: "DELETE FROM stock_entries WHERE item_id = ?", args: [id] });
    const now = new Date().toISOString();
    for (const entry of nonEmpty) {
      let locationId: string | null = null;
      if (entry.location) {
        const locationResult = await tx.execute({ sql: "SELECT id FROM locations WHERE workspace_id = ? AND name = ?", args: [workspaceId, entry.location] });
        if (locationResult.rows.length) locationId = String(locationResult.rows[0].id);
        else {
          locationId = crypto.randomUUID();
          await tx.execute({ sql: "INSERT INTO locations (id, workspace_id, name, created_at) VALUES (?, ?, ?, ?)", args: [locationId, workspaceId, entry.location, now] });
        }
      }
      await tx.execute({ sql: "INSERT INTO stock_entries (id, item_id, location_id, quantity, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)", args: [crypto.randomUUID(), id, locationId, entry.quantity, now, now] });
    }
    if (!nonEmpty.length) await tx.execute({ sql: "INSERT INTO stock_entries (id, item_id, location_id, quantity, created_at, updated_at) VALUES (?, ?, NULL, 0, ?, ?)", args: [crypto.randomUUID(), id, now, now] });
    await tx.commit();
  } catch (error) { await tx.rollback(); throw error; }
}

export async function deleteItem(id: string) {
  id = itemIdInput.parse(id);
  const { db, workspaceId } = await initializeWorkspace();
  const tx = await beginWriteTransaction(db);
  try {
    await tx.execute({ sql: "DELETE FROM stock_entries WHERE item_id = ?", args: [id] });
    await tx.execute({ sql: "DELETE FROM items WHERE id = ? AND workspace_id = ?", args: [id, workspaceId] });
    await tx.commit();
  } catch (error) { await tx.rollback(); throw error; }
}
