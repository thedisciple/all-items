import { z } from "zod";
import { initializeWorkspace } from "@/db/client";

const collectionIdSchema = z.string().uuid();
const collectionInputSchema = z.object({ name: z.string().trim().min(1, "Введите название коллекции").max(120, "Название — не более 120 символов") });

function normalizedName(name: string) { return name.normalize("NFKC").toLocaleLowerCase("ru-RU"); }

function isUniqueViolation(error: unknown) {
  return error instanceof Error && /UNIQUE constraint failed/i.test(error.message);
}

export async function listCollections() {
  const { db, workspaceId } = await initializeWorkspace();
  const result = await db.$client.execute({
    sql: `SELECT c.id, c.name, c.created_at AS createdAt, c.updated_at AS updatedAt,
                 COUNT(DISTINCT icm.item_id) AS itemCount,
                 (SELECT m.id FROM item_collection_memberships inner_membership
                  INNER JOIN media_assets m ON m.item_id = inner_membership.item_id AND m.is_primary = 1
                  WHERE inner_membership.collection_id = c.id ORDER BY inner_membership.created_at LIMIT 1) AS previewMediaId,
                 (SELECT inner_membership.item_id FROM item_collection_memberships inner_membership
                  WHERE inner_membership.collection_id = c.id ORDER BY inner_membership.created_at LIMIT 1) AS previewItemId
          FROM collections c LEFT JOIN item_collection_memberships icm ON icm.collection_id = c.id
          WHERE c.workspace_id = ? GROUP BY c.id ORDER BY lower(c.name), c.id`,
    args: [workspaceId],
  });
  return result.rows.map((row) => ({
    id: String(row.id),
    name: String(row.name),
    createdAt: String(row.createdAt),
    updatedAt: String(row.updatedAt),
    itemCount: Number(row.itemCount),
    previewMediaId: row.previewMediaId == null ? null : String(row.previewMediaId),
    previewItemId: row.previewItemId == null ? null : String(row.previewItemId),
  }));
}

export async function getCollection(idValue: unknown) {
  const id = collectionIdSchema.parse(idValue);
  const { db, workspaceId } = await initializeWorkspace();
  const result = await db.$client.execute({
    sql: `SELECT c.id, c.name, c.created_at AS createdAt, c.updated_at AS updatedAt, COUNT(DISTINCT icm.item_id) AS itemCount
          FROM collections c LEFT JOIN item_collection_memberships icm ON icm.collection_id = c.id
          WHERE c.workspace_id = ? AND c.id = ? GROUP BY c.id LIMIT 1`,
    args: [workspaceId, id],
  });
  if (!result.rows.length) return null;
  const row = result.rows[0];
  return { id: String(row.id), name: String(row.name), createdAt: String(row.createdAt), updatedAt: String(row.updatedAt), itemCount: Number(row.itemCount) };
}

export async function createCollection(input: unknown) {
  const { name } = collectionInputSchema.parse(input);
  const { db, workspaceId } = await initializeWorkspace();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  try {
    await db.$client.execute({ sql: "INSERT INTO collections (id, workspace_id, name, normalized_name, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)", args: [id, workspaceId, name, normalizedName(name), now, now] });
  } catch (error) {
    if (isUniqueViolation(error)) throw new Error("Такая коллекция уже есть.");
    throw error;
  }
  return { id, name };
}

export async function renameCollection(idValue: unknown, input: unknown) {
  const id = collectionIdSchema.parse(idValue);
  const { name } = collectionInputSchema.parse(input);
  const { db, workspaceId } = await initializeWorkspace();
  try {
    const result = await db.$client.execute({ sql: "UPDATE collections SET name = ?, normalized_name = ?, updated_at = ? WHERE id = ? AND workspace_id = ?", args: [name, normalizedName(name), new Date().toISOString(), id, workspaceId] });
    if (!result.rowsAffected) throw new Error("Коллекция не найдена.");
  } catch (error) {
    if (isUniqueViolation(error)) throw new Error("Такая коллекция уже есть.");
    throw error;
  }
}

export async function deleteCollection(idValue: unknown) {
  const id = collectionIdSchema.parse(idValue);
  const { db, workspaceId } = await initializeWorkspace();
  const result = await db.$client.execute({ sql: "DELETE FROM collections WHERE id = ? AND workspace_id = ?", args: [id, workspaceId] });
  return result.rowsAffected > 0;
}

export async function listItemCollections(itemIdValue: unknown) {
  const itemId = collectionIdSchema.parse(itemIdValue);
  const { db, workspaceId } = await initializeWorkspace();
  const result = await db.$client.execute({
    sql: `SELECT c.id, c.name FROM collections c
          INNER JOIN item_collection_memberships icm ON icm.collection_id = c.id
          INNER JOIN items i ON i.id = icm.item_id
          WHERE c.workspace_id = ? AND i.workspace_id = ? AND i.id = ? ORDER BY lower(c.name), c.id`,
    args: [workspaceId, workspaceId, itemId],
  });
  return result.rows.map((row) => ({ id: String(row.id), name: String(row.name) }));
}

export async function addItemToCollection(collectionIdValue: unknown, itemIdValue: unknown) {
  const collectionId = collectionIdSchema.parse(collectionIdValue);
  const itemId = collectionIdSchema.parse(itemIdValue);
  const { db, workspaceId } = await initializeWorkspace();
  const tx = await db.$client.transaction("write");
  try {
    const collection = await tx.execute({ sql: "SELECT id FROM collections WHERE id = ? AND workspace_id = ?", args: [collectionId, workspaceId] });
    const item = await tx.execute({ sql: "SELECT id FROM items WHERE id = ? AND workspace_id = ?", args: [itemId, workspaceId] });
    if (!collection.rows.length) throw new Error("Коллекция не найдена.");
    if (!item.rows.length) throw new Error("Вещь не найдена.");
    await tx.execute({ sql: "INSERT INTO item_collection_memberships (id, collection_id, item_id, created_at) VALUES (?, ?, ?, ?) ON CONFLICT(item_id, collection_id) DO NOTHING", args: [crypto.randomUUID(), collectionId, itemId, new Date().toISOString()] });
    await tx.commit();
  } catch (error) { await tx.rollback(); throw error; }
}

export async function removeItemFromCollection(collectionIdValue: unknown, itemIdValue: unknown) {
  const collectionId = collectionIdSchema.parse(collectionIdValue);
  const itemId = collectionIdSchema.parse(itemIdValue);
  const { db, workspaceId } = await initializeWorkspace();
  const result = await db.$client.execute({
    sql: `DELETE FROM item_collection_memberships
          WHERE collection_id = ? AND item_id = ? AND EXISTS (SELECT 1 FROM collections c WHERE c.id = ? AND c.workspace_id = ?)
            AND EXISTS (SELECT 1 FROM items i WHERE i.id = ? AND i.workspace_id = ?)`,
    args: [collectionId, itemId, collectionId, workspaceId, itemId, workspaceId],
  });
  return result.rowsAffected > 0;
}
