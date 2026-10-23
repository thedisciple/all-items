import { z } from "zod";
import { initializeWorkspace } from "@/db/client";

const collectionIdSchema = z.string().uuid();
export const collectionIcons = ["🙂", "⭐", "🎁", "🛠️", "🏠", "🌿", "📷", "📚", "🎨", "📦"] as const;
const iconSchema = z.string().trim().min(1).max(32).refine((value) => /\p{Extended_Pictographic}/u.test(value) || /^[\p{Regional_Indicator}]{2}$/u.test(value)).nullable().optional();
const collectionCreateSchema = z.object({ name: z.string().trim().min(1, "Введите название коллекции").max(120, "Название — не более 120 символов"), icon: z.preprocess((value) => value === "" ? null : value, iconSchema) });
const collectionInputSchema = collectionCreateSchema;
const batchItemIdsSchema = z.array(z.string().uuid()).min(1).max(500).refine((ids) => new Set(ids).size === ids.length);
const coverSelectionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("item_photo"), itemId: z.string().uuid(), mediaId: z.string().uuid() }),
  z.object({ type: z.literal("emoji"), icon: iconSchema.unwrap().unwrap() }),
  z.object({ type: z.literal("default") }),
]);

function normalizedName(name: string) { return name.normalize("NFKC").toLocaleLowerCase("ru-RU"); }

function isUniqueViolation(error: unknown) {
  return error instanceof Error && /UNIQUE constraint failed/i.test(error.message);
}

export async function listCollections() {
  const { db, workspaceId } = await initializeWorkspace();
  const result = await db.$client.execute({
    sql: `SELECT c.id, c.name, c.created_at AS createdAt, c.updated_at AS updatedAt, c.icon,
                 CASE WHEN c.cover_type = 'item_photo' AND EXISTS (
                   SELECT 1 FROM item_collection_memberships cm JOIN media_assets m ON m.item_id = cm.item_id AND m.id = c.cover_media_id AND m.is_primary = 1
                   WHERE cm.collection_id = c.id AND cm.item_id = c.cover_item_id
                 ) THEN 'item_photo'
                 WHEN c.cover_type = 'upload' AND EXISTS (SELECT 1 FROM collection_cover_assets ca WHERE ca.id = c.cover_upload_id AND ca.collection_id = c.id) THEN 'upload'
                 WHEN c.cover_type = 'emoji' AND c.cover_icon IS NOT NULL THEN 'emoji' ELSE 'default' END AS coverType,
                 c.cover_icon AS coverIcon, c.cover_item_id AS coverItemId, c.cover_media_id AS coverMediaId, c.cover_upload_id AS coverUploadId,
                 COUNT(DISTINCT icm.item_id) AS itemCount
          FROM collections c LEFT JOIN item_collection_memberships icm ON icm.collection_id = c.id
          WHERE c.workspace_id = ? GROUP BY c.id ORDER BY lower(c.name), c.id`,
    args: [workspaceId],
  });
  return result.rows.map((row) => ({
    id: String(row.id),
    name: String(row.name),
    icon: row.icon == null ? null : String(row.icon),
    createdAt: String(row.createdAt),
    updatedAt: String(row.updatedAt),
    itemCount: Number(row.itemCount),
    coverType: String(row.coverType), coverIcon: row.coverIcon == null ? null : String(row.coverIcon),
    coverItemId: row.coverItemId == null ? null : String(row.coverItemId), coverMediaId: row.coverMediaId == null ? null : String(row.coverMediaId), coverUploadId: row.coverUploadId == null ? null : String(row.coverUploadId),
  }));
}

export async function getCollection(idValue: unknown) {
  const id = collectionIdSchema.parse(idValue);
  const { db, workspaceId } = await initializeWorkspace();
  const result = await db.$client.execute({
    sql: `SELECT c.id, c.name, c.created_at AS createdAt, c.updated_at AS updatedAt, c.icon,
                 CASE WHEN c.cover_type = 'item_photo' AND EXISTS (SELECT 1 FROM item_collection_memberships cm JOIN media_assets m ON m.item_id = cm.item_id AND m.id = c.cover_media_id AND m.is_primary = 1 WHERE cm.collection_id = c.id AND cm.item_id = c.cover_item_id) THEN 'item_photo'
                 WHEN c.cover_type = 'upload' AND EXISTS (SELECT 1 FROM collection_cover_assets ca WHERE ca.id = c.cover_upload_id AND ca.collection_id = c.id)
                 THEN 'upload' WHEN c.cover_type = 'emoji' AND c.cover_icon IS NOT NULL THEN 'emoji' ELSE 'default' END AS coverType, c.cover_icon AS coverIcon,
                 c.cover_item_id AS coverItemId, c.cover_media_id AS coverMediaId, c.cover_upload_id AS coverUploadId,
                 COUNT(DISTINCT icm.item_id) AS itemCount
          FROM collections c LEFT JOIN item_collection_memberships icm ON icm.collection_id = c.id
          WHERE c.workspace_id = ? AND c.id = ? GROUP BY c.id LIMIT 1`,
    args: [workspaceId, id],
  });
  if (!result.rows.length) return null;
  const row = result.rows[0];
  return { id: String(row.id), name: String(row.name), createdAt: String(row.createdAt), updatedAt: String(row.updatedAt), itemCount: Number(row.itemCount), icon: row.icon == null ? null : String(row.icon), coverType: row.coverType == null ? "default" : String(row.coverType), coverIcon: row.coverIcon == null ? null : String(row.coverIcon), coverItemId: row.coverItemId == null ? null : String(row.coverItemId), coverMediaId: row.coverMediaId == null ? null : String(row.coverMediaId), coverUploadId: row.coverUploadId == null ? null : String(row.coverUploadId) };
}

export async function createCollection(input: unknown) {
  const { name, icon } = collectionCreateSchema.parse(input);
  const { db, workspaceId } = await initializeWorkspace();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  try {
    await db.$client.execute({ sql: "INSERT INTO collections (id, workspace_id, name, normalized_name, created_at, updated_at, icon, cover_type, cover_icon) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)", args: [id, workspaceId, name, normalizedName(name), now, now, icon ?? null, icon ? "emoji" : null, icon ?? null] });
  } catch (error) {
    if (isUniqueViolation(error)) throw new Error("Такая коллекция уже есть.");
    throw error;
  }
  return { id, name, icon: icon ?? null };
}

export async function renameCollection(idValue: unknown, input: unknown) {
  const id = collectionIdSchema.parse(idValue);
  const { name, icon } = collectionInputSchema.parse(input);
  const iconProvided = typeof input === "object" && input !== null && Object.hasOwn(input, "icon");
  const { db, workspaceId } = await initializeWorkspace();
  try {
    const result = iconProvided
      ? await db.$client.execute({ sql: "UPDATE collections SET name = ?, normalized_name = ?, icon = ?, cover_icon = CASE WHEN cover_type = 'emoji' THEN ? ELSE cover_icon END, updated_at = ? WHERE id = ? AND workspace_id = ?", args: [name, normalizedName(name), icon ?? null, icon ?? null, new Date().toISOString(), id, workspaceId] })
      : await db.$client.execute({ sql: "UPDATE collections SET name = ?, normalized_name = ?, updated_at = ? WHERE id = ? AND workspace_id = ?", args: [name, normalizedName(name), new Date().toISOString(), id, workspaceId] });
    if (!result.rowsAffected) throw new Error("Коллекция не найдена.");
  } catch (error) {
    if (isUniqueViolation(error)) throw new Error("Такая коллекция уже есть.");
    throw error;
  }
}

export async function deleteCollection(idValue: unknown) {
  const id = collectionIdSchema.parse(idValue);
  const { db, workspaceId } = await initializeWorkspace();
  const assets = await db.$client.execute({ sql: "SELECT ca.id, ca.collection_id, ca.storage_path, ca.thumbnail_path FROM collection_cover_assets ca JOIN collections c ON c.id = ca.collection_id WHERE ca.collection_id = ? AND c.workspace_id = ?", args: [id, workspaceId] });
  const result = await db.$client.execute({ sql: "DELETE FROM collections WHERE id = ? AND workspace_id = ?", args: [id, workspaceId] });
  if (assets.rows.length) {
    const { removeCollectionCoverAssetFiles } = await import("@/media/collection-covers");
    for (const asset of assets.rows as unknown as Array<{ id: string; collection_id: string; storage_path: string; thumbnail_path: string }>) {
      try { await removeCollectionCoverAssetFiles(asset); } catch (error) { console.error("Unable to remove deleted collection cover files", error); }
    }
  }
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

export async function addItemsToCollection(collectionIdValue: unknown, itemIdsValue: unknown) {
  const collectionId = collectionIdSchema.parse(collectionIdValue);
  const itemIds = batchItemIdsSchema.parse(itemIdsValue);
  const { db, workspaceId } = await initializeWorkspace();
  const tx = await db.$client.transaction("write");
  try {
    const collection = await tx.execute({ sql: "SELECT id FROM collections WHERE id = ? AND workspace_id = ?", args: [collectionId, workspaceId] });
    if (!collection.rows.length) throw new Error("Коллекция не найдена.");
    const placeholders = itemIds.map(() => "?").join(",");
    const items = await tx.execute({ sql: `SELECT id FROM items WHERE workspace_id = ? AND id IN (${placeholders})`, args: [workspaceId, ...itemIds] });
    if (items.rows.length !== itemIds.length) throw new Error("Вещь не найдена");
    let added = 0;
    const now = new Date().toISOString();
    for (const itemId of itemIds) {
      const result = await tx.execute({ sql: "INSERT INTO item_collection_memberships (id, collection_id, item_id, created_at) VALUES (?, ?, ?, ?) ON CONFLICT(item_id, collection_id) DO NOTHING", args: [crypto.randomUUID(), collectionId, itemId, now] });
      added += result.rowsAffected;
    }
    await tx.commit();
    return { added };
  } catch (error) { await tx.rollback(); throw error; }
}

export async function listCollectionCoverOptions(collectionIdValue: unknown) {
  const collectionId = collectionIdSchema.parse(collectionIdValue);
  const { db, workspaceId } = await initializeWorkspace();
  const result = await db.$client.execute({
    sql: `SELECT i.id AS itemId, i.name, i.model, m.id AS mediaId
          FROM item_collection_memberships cm JOIN items i ON i.id = cm.item_id
          JOIN media_assets m ON m.item_id = i.id AND m.is_primary = 1
          WHERE cm.collection_id = ? AND i.workspace_id = ? ORDER BY lower(i.name), i.id`,
    args: [collectionId, workspaceId],
  });
  return result.rows.map((row) => ({ itemId: String(row.itemId), name: String(row.name), model: row.model == null ? null : String(row.model), mediaId: String(row.mediaId) }));
}

export async function setCollectionCover(collectionIdValue: unknown, input: unknown) {
  const collectionId = collectionIdSchema.parse(collectionIdValue);
  const selection = coverSelectionSchema.parse(input);
  const { db, workspaceId } = await initializeWorkspace();
  const tx = await db.$client.transaction("write");
  let oldUpload: { id: string; collection_id: string; storage_path: string; thumbnail_path: string } | null = null;
  try {
    const collection = await tx.execute({ sql: "SELECT id, cover_upload_id FROM collections WHERE id = ? AND workspace_id = ?", args: [collectionId, workspaceId] });
    if (!collection.rows.length) throw new Error("Коллекция не найдена.");
    const row = collection.rows[0];
    if (row.cover_upload_id) {
      const old = await tx.execute({ sql: "SELECT id, collection_id, storage_path, thumbnail_path FROM collection_cover_assets WHERE id = ? AND collection_id = ?", args: [row.cover_upload_id, collectionId] });
      if (old.rows.length) oldUpload = old.rows[0] as unknown as NonNullable<typeof oldUpload>;
      await tx.execute({ sql: "DELETE FROM collection_cover_assets WHERE collection_id = ?", args: [collectionId] });
    }
    if (selection.type === "item_photo") {
      const valid = await tx.execute({ sql: `SELECT m.id FROM item_collection_memberships cm JOIN items i ON i.id = cm.item_id JOIN media_assets m ON m.item_id = i.id AND m.id = ? AND m.is_primary = 1 WHERE cm.collection_id = ? AND cm.item_id = ? AND i.workspace_id = ?`, args: [selection.mediaId, collectionId, selection.itemId, workspaceId] });
      if (!valid.rows.length) throw new Error("Фото для обложки не найдено.");
    }
    await tx.execute({ sql: `UPDATE collections SET cover_type = ?, cover_icon = ?, icon = CASE WHEN ? = 'emoji' THEN ? ELSE icon END, cover_item_id = ?, cover_media_id = ?, cover_upload_id = NULL, updated_at = ? WHERE id = ? AND workspace_id = ?`, args: [selection.type, selection.type === "emoji" ? selection.icon : null, selection.type, selection.type === "emoji" ? selection.icon : null, selection.type === "item_photo" ? selection.itemId : null, selection.type === "item_photo" ? selection.mediaId : null, new Date().toISOString(), collectionId, workspaceId] });
    await tx.commit();
  } catch (error) { await tx.rollback(); throw error; }
  if (oldUpload) {
    const { removeCollectionCoverAssetFiles } = await import("@/media/collection-covers");
    try { await removeCollectionCoverAssetFiles(oldUpload); } catch (error) { console.error("Unable to remove replaced collection cover files", error); }
  }
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
