import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { dataDirectory } from "@/db/client";
import { inventoryDatabase } from "@/items/inventories";
import type { InventoryContext } from "@/items/inventory-context";
import { preparePrivateImage, MediaValidationError } from "@/media/service";

const idSchema = z.string().uuid();
type CoverAsset = { id: string; collection_id: string; storage_path: string; thumbnail_path: string };

function coverPaths(collectionIdValue: string, mediaIdValue: string) {
  const collectionId = idSchema.parse(collectionIdValue);
  const mediaId = idSchema.parse(mediaIdValue);
  const root = path.resolve(dataDirectory(), "media");
  const directory = path.resolve(root, "collections", collectionId);
  const full = path.resolve(directory, `${mediaId}.webp`);
  const thumbnail = path.resolve(directory, `${mediaId}-thumb.webp`);
  for (const file of [full, thumbnail]) {
    const relative = path.relative(root, file);
    if (relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) throw new Error("Unsafe collection cover path");
  }
  return { full, thumbnail, relativeFull: `collections/${collectionId}/${mediaId}.webp`, relativeThumbnail: `collections/${collectionId}/${mediaId}-thumb.webp` };
}

function assertPaths(asset: CoverAsset) {
  const paths = coverPaths(asset.collection_id, asset.id);
  if (asset.storage_path !== paths.relativeFull || asset.thumbnail_path !== paths.relativeThumbnail) throw new Error("Stored collection cover path is invalid");
  return paths;
}

export async function removeCollectionCoverAssetFiles(context: InventoryContext, asset: CoverAsset) {
  const { getDatabase } = await import("@/db/client");
  const live = await (await getDatabase()).$client.execute({ sql: "SELECT c.workspace_id FROM collection_cover_assets ca JOIN collections c ON c.id=ca.collection_id WHERE ca.id=?", args: [asset.id] });
  if (live.rows.some(owner => owner.workspace_id !== context.workspaceId)) throw new Error("Invalid cover cleanup inventory");
  const paths = assertPaths(asset);
  await Promise.all([rm(paths.full, { force: true }), rm(paths.thumbnail, { force: true })]);
}

export async function replaceCollectionCoverUpload(context: InventoryContext, collectionIdValue: unknown, file: File) {
  const collectionId = idSchema.parse(collectionIdValue);
  const { db, workspaceId } = await inventoryDatabase(context);
  const owner = await db.$client.execute({ sql: "SELECT id FROM collections WHERE id=? AND workspace_id=?", args: [collectionId,workspaceId] });
  if (!owner.rows.length) throw new Error("Collection not found");
  const image = await preparePrivateImage(file);
  const id = crypto.randomUUID();
  const paths = coverPaths(collectionId, id);
  await mkdir(path.dirname(paths.full), { recursive: true });
  try {
    await writeFile(paths.full, image.full, { flag: "wx" });
    await writeFile(paths.thumbnail, image.thumbnail, { flag: "wx" });
  } catch (error) {
    await Promise.all([rm(paths.full, { force: true }), rm(paths.thumbnail, { force: true })]);
    throw error;
  }

  const staged = { id, collection_id: collectionId, storage_path: paths.relativeFull, thumbnail_path: paths.relativeThumbnail };
  const tx = await db.$client.transaction("write").catch(async (error: unknown) => { await removeCollectionCoverAssetFiles(context, staged); throw error; });
  let oldAssets: CoverAsset[] = [];
  try {
    const collection = await tx.execute({ sql: "SELECT id FROM collections WHERE id = ? AND workspace_id = ?", args: [collectionId, workspaceId] });
    if (!collection.rows.length) throw new Error("Коллекция не найдена.");
    const old = await tx.execute({ sql: "SELECT id, collection_id, storage_path, thumbnail_path FROM collection_cover_assets WHERE collection_id = ?", args: [collectionId] });
    oldAssets = old.rows as unknown as CoverAsset[];
    await tx.execute({ sql: "DELETE FROM collection_cover_assets WHERE collection_id = ?", args: [collectionId] });
    await tx.execute({ sql: "INSERT INTO collection_cover_assets (id, collection_id, storage_path, thumbnail_path, width, height, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)", args: [id, collectionId, paths.relativeFull, paths.relativeThumbnail, image.width, image.height, new Date().toISOString()] });
    await tx.execute({ sql: "UPDATE collections SET cover_type = 'upload', cover_icon = NULL, cover_item_id = NULL, cover_media_id = NULL, cover_upload_id = ?, updated_at = ? WHERE id = ? AND workspace_id = ?", args: [id, new Date().toISOString(), collectionId, workspaceId] });
    await tx.commit();
  } catch (error) {
    await tx.rollback();
    await removeCollectionCoverAssetFiles(context, staged);
    if (error instanceof MediaValidationError) throw error;
    throw error;
  }
  for (const old of oldAssets) {
    try { await removeCollectionCoverAssetFiles(context, old); } catch (error) { console.error("Unable to remove replaced collection cover files", error); }
  }
  return id;
}

export async function readCollectionCover(context: InventoryContext, collectionIdValue: string, mediaIdValue: string, thumbnail = true) {
  const collectionId = idSchema.parse(collectionIdValue);
  const mediaId = idSchema.parse(mediaIdValue);
  const { db, workspaceId } = await inventoryDatabase(context);
  const result = await db.$client.execute({
    sql: `SELECT ca.id, ca.collection_id, ca.storage_path, ca.thumbnail_path FROM collection_cover_assets ca
          JOIN collections c ON c.id = ca.collection_id
          WHERE ca.id = ? AND ca.collection_id = ? AND c.workspace_id = ? AND c.cover_type = 'upload' AND c.cover_upload_id = ? LIMIT 1`,
    args: [mediaId, collectionId, workspaceId, mediaId],
  });
  if (!result.rows.length) return null;
  const asset = result.rows[0] as unknown as CoverAsset;
  const paths = assertPaths(asset);
  return readFile(thumbnail ? paths.thumbnail : paths.full);
}
