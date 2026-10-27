import { assertPrivatePath } from "@/media/private-paths";
import sharp, { type Metadata } from "sharp";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { dataDirectory } from "@/db/client";
import { inventoryDatabase } from "@/items/inventories";
import type { InventoryContext } from "@/items/inventory-context";
import { createItem, type ItemFields } from "@/items/service";
import { cropDataSchema } from "@/media/crop-data";

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_IMAGE_SIDE = 12_000;
export const MAX_IMAGE_PIXELS = 40_000_000;
const mediaIdSchema = z.string().uuid();
const mediaVariantSchema = z.enum(["image", "thumbnail"]);
const uploadedFileSchema = z.custom<File>((value) => typeof File !== "undefined" && value instanceof File, "Выберите файл фотографии.")
  .refine((file) => file.size > 0, "Выберите непустой файл фотографии.")
  .refine((file) => file.size <= MAX_IMAGE_BYTES, "Размер фотографии должен быть не более 10 МиБ.");
const dimensionsSchema = z.object({ width: z.number().int().positive(), height: z.number().int().positive() })
  .refine(({ width, height }) => width <= MAX_IMAGE_SIDE && height <= MAX_IMAGE_SIDE && width * height <= MAX_IMAGE_PIXELS);
const supportedFormats = new Set(["jpeg", "png", "webp"]);
type Variant = z.infer<typeof mediaVariantSchema> | "source";
type AssetPaths = { full: string; thumbnail: string; source: string; relativeFull: string; relativeThumbnail: string; relativeSource: string };
type StoredAsset = { id: string; item_id: string; storage_path: string; thumbnail_path: string; source_storage_path?: string | null };

export class MediaValidationError extends Error {
  constructor(message: string) { super(message); this.name = "MediaValidationError"; }
}

function mediaRoot() {
  return path.resolve(dataDirectory(), "media", "items");
}

function assetPaths(itemId: string, mediaId: string): AssetPaths {
  const safeItemId = mediaIdSchema.parse(itemId);
  const safeMediaId = mediaIdSchema.parse(mediaId);
  const root = mediaRoot();
  const relativeFull = `${safeItemId}/${safeMediaId}.webp`;
  const relativeThumbnail = `${safeItemId}/${safeMediaId}-thumb.webp`;
  const relativeSource = `${safeItemId}/${safeMediaId}-source.webp`;
  const full = path.resolve(root, safeItemId, `${safeMediaId}.webp`);
  const thumbnail = path.resolve(root, safeItemId, `${safeMediaId}-thumb.webp`);
  const source = path.resolve(root, safeItemId, `${safeMediaId}-source.webp`);
  for (const resolved of [full, thumbnail, source]) {
    const relative = path.relative(root, resolved);
    if (relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
      throw new Error("Unsafe media path");
    }
  }
  return { full, thumbnail, source, relativeFull, relativeThumbnail, relativeSource };
}

function assertStoredPaths(row: StoredAsset) {
  const paths = assetPaths(row.item_id, row.id);
  if (row.storage_path !== paths.relativeFull || row.thumbnail_path !== paths.relativeThumbnail) {
    throw new Error("Stored media path does not match its generated identifier");
  }
  if (row.source_storage_path != null && row.source_storage_path !== paths.relativeSource) throw new Error("Stored source path does not match its generated identifier");
  return paths;
}

export async function removeAssetFiles(context: InventoryContext, row: StoredAsset) {
  const db = (await import("@/db/client")).getDatabase;
  const live = await (await db()).$client.execute({ sql: "SELECT i.workspace_id FROM media_assets m JOIN items i ON i.id=m.item_id WHERE m.id=?", args: [row.id] });
  if (live.rows.some(owner => owner.workspace_id !== context.workspaceId)) throw new Error("Invalid media cleanup inventory");
  const paths = assertStoredPaths(row);
  for(const file of [paths.full,paths.thumbnail,paths.source]) await assertPrivatePath(dataDirectory(),file);
  await Promise.all([rm(paths.full, { force: true }), rm(paths.thumbnail, { force: true }), rm(paths.source, { force: true })]);
}

async function processImage(file: File, sourceFile: File = file, cropValue = "", keepEditableSource = true) {
  const validFile = uploadedFileSchema.safeParse(file);
  if (!validFile.success) throw new MediaValidationError(validFile.error.issues[0]?.message ?? "Файл фотографии недопустим.");
  const input = Buffer.from(await file.arrayBuffer());
  if (input.byteLength < 1 || input.byteLength > MAX_IMAGE_BYTES) {
    throw new MediaValidationError("Размер фотографии должен быть не более 10 МиБ.");
  }

  let metadata: Metadata;
  try {
    metadata = await sharp(input, { failOn: "error", limitInputPixels: MAX_IMAGE_PIXELS, pages: 1 }).metadata();
  } catch {
    throw new MediaValidationError("Не удалось прочитать фотографию. Выберите JPEG, PNG или WebP.");
  }
  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;
  if (!metadata.format || !supportedFormats.has(metadata.format)) {
    throw new MediaValidationError("Поддерживаются только фотографии JPEG, PNG и WebP.");
  }
  if (!dimensionsSchema.safeParse({ width, height }).success) {
    throw new MediaValidationError("Размер изображения слишком большой. Максимум — 12 000 пикселей по стороне и 40 Мп.");
  }

  try {
    const normalized = await sharp(input, { failOn: "error", limitInputPixels: MAX_IMAGE_PIXELS, pages: 1 })
      .rotate().resize({ width: 2400, height: 2400, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 84, effort: 4 }).toBuffer({ resolveWithObject: true });
    const thumbnail = await sharp(input, { failOn: "error", limitInputPixels: MAX_IMAGE_PIXELS, pages: 1 })
      .rotate().resize({ width: 480, height: 480, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 76, effort: 4 }).toBuffer();
    const sourceInput = Buffer.from(await sourceFile.arrayBuffer());
    const validSource = uploadedFileSchema.safeParse(sourceFile);
    if (!validSource.success || sourceInput.length < 1 || sourceInput.length > MAX_IMAGE_BYTES) throw new MediaValidationError("Исходная фотография недопустима.");
    const sourceMetadata = await sharp(sourceInput, { failOn: "error", limitInputPixels: MAX_IMAGE_PIXELS, pages: 1 }).metadata();
    if (!sourceMetadata.format || !supportedFormats.has(sourceMetadata.format) || !dimensionsSchema.safeParse({ width: sourceMetadata.width ?? 0, height: sourceMetadata.height ?? 0 }).success) throw new MediaValidationError("Размер исходной фотографии недопустим.");
    const source = keepEditableSource ? await sharp(sourceInput, { failOn: "error", limitInputPixels: MAX_IMAGE_PIXELS, pages: 1 }).rotate().webp({ quality: 88, effort: 4 }).toBuffer() : normalized.data;
    let cropData: string | null = null;
    if (cropValue) {
      let parsed: unknown;
      try { parsed = JSON.parse(cropValue); } catch { throw new MediaValidationError("Параметры кадрирования недопустимы."); }
      const validCrop = cropDataSchema.safeParse(parsed);
      if (!validCrop.success) throw new MediaValidationError("Параметры кадрирования недопустимы.");
      cropData = JSON.stringify(validCrop.data);
    }
    const originalFilename = path.basename(file.name.replace(/\\/g, "/"))
      .replace(/[\u0000-\u001f\u007f]/g, "").slice(0, 255) || "photo";
    return { full: normalized.data, thumbnail, source, cropData, width: normalized.info.width, height: normalized.info.height, originalFilename };
  } catch {
    throw new MediaValidationError("Фотографию не удалось обработать. Попробуйте другой файл.");
  }
}

export async function preparePrivateImage(file: File) {
  return processImage(file, file, "", false);
}

async function writeAssetFiles(itemId: string, mediaId: string, image: Awaited<ReturnType<typeof processImage>>) {
  const paths = assetPaths(itemId, mediaId);
  for(const file of [paths.full,paths.thumbnail,paths.source]) await assertPrivatePath(dataDirectory(),file);
  await mkdir(path.dirname(paths.full), { recursive: true });
  try {
    await writeFile(paths.full, image.full, { flag: "wx" });
    await writeFile(paths.thumbnail, image.thumbnail, { flag: "wx" });
    await writeFile(paths.source, image.source, { flag: "wx" });
  } catch (error) {
    await Promise.all([rm(paths.full, { force: true }), rm(paths.thumbnail, { force: true }), rm(paths.source, { force: true })]);
    throw error;
  }
  return paths;
}

async function setPrimaryPhoto(context: InventoryContext, itemId: string, image: Awaited<ReturnType<typeof processImage>>) {
  const { db, workspaceId } = await inventoryDatabase(context);
  const owner = await db.$client.execute({ sql: "SELECT id FROM items WHERE id=? AND workspace_id=?", args: [itemId,workspaceId] });
  if (!owner.rows.length) throw new Error("Item not found");
  const mediaId = crypto.randomUUID();
  const paths = await writeAssetFiles(itemId, mediaId, image);
  const newAsset = { id: mediaId, item_id: itemId, storage_path: paths.relativeFull, thumbnail_path: paths.relativeThumbnail, source_storage_path: paths.relativeSource };
  const tx = await db.$client.transaction("write").catch(async (error: unknown) => {
    try { await removeAssetFiles(context, newAsset); }
    catch (cleanupError) { console.error("Unable to remove staged private image files", cleanupError); }
    throw error;
  });
  let previous: StoredAsset[] = [];
  try {
    const existing = await tx.execute({ sql: "SELECT id, item_id, storage_path, thumbnail_path, source_storage_path FROM media_assets WHERE item_id = ? AND is_primary = 1", args: [itemId] });
    previous = existing.rows as unknown as StoredAsset[];
    const item = await tx.execute({ sql: "SELECT id FROM items WHERE id = ? AND workspace_id = ?", args: [itemId, workspaceId] });
    if (!item.rows.length) throw new Error("Вещь не найдена");
    await tx.execute({ sql: "DELETE FROM media_assets WHERE item_id = ? AND is_primary = 1 AND EXISTS(SELECT 1 FROM items WHERE id=? AND workspace_id=?)", args: [itemId,itemId,workspaceId] });
    await tx.execute({
      sql: `INSERT INTO media_assets (id, item_id, storage_path, thumbnail_path, source_storage_path, crop_data, original_filename, mime_type, width, height, created_at, is_primary)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'image/webp', ?, ?, ?, 1)`,
      args: [mediaId, itemId, paths.relativeFull, paths.relativeThumbnail, paths.relativeSource, image.cropData, image.originalFilename, image.width, image.height, new Date().toISOString()],
    });
    await tx.commit();
  } catch (error) {
    await tx.rollback();
    try { await removeAssetFiles(context, newAsset); }
    catch (cleanupError) { console.error("Unable to remove staged private image files", cleanupError); }
    throw error;
  }
  for (const oldAsset of previous) {
    try { await removeAssetFiles(context, oldAsset); }
    catch (error) { console.error("Unable to remove replaced private image files", error); }
  }
  return { id: mediaId, width: image.width, height: image.height, createdAt: new Date().toISOString() };
}

export async function createItemWithPhoto(context: InventoryContext, input: ItemFields, file: File, sourceFile: File = file, cropValue = "", stock?: unknown) {
  const image = await processImage(file, sourceFile, cropValue);
  const mediaId = crypto.randomUUID();
  let staged: Awaited<ReturnType<typeof writeAssetFiles>> | null = null;
  try {
    return await createItem(context, input, stock, async (tx, itemId) => {
      const paths = await writeAssetFiles(itemId, mediaId, image);
      staged = paths;
      await tx.execute({
        sql: `INSERT INTO media_assets (id, item_id, storage_path, thumbnail_path, source_storage_path, crop_data, original_filename, mime_type, width, height, created_at, is_primary)
              VALUES (?, ?, ?, ?, ?, ?, ?, 'image/webp', ?, ?, ?, 1)`,
        args: [mediaId, itemId, paths.relativeFull, paths.relativeThumbnail, paths.relativeSource, image.cropData, image.originalFilename, image.width, image.height, new Date().toISOString()],
      });
    });
  } catch (error) {
    const paths = staged as Awaited<ReturnType<typeof writeAssetFiles>> | null;
    if (paths) {
      try {
        // A commit may have succeeded even if its acknowledgement failed. Never
        // remove a staged file when a live record refers to the new media ID.
        const { db } = await inventoryDatabase(context);
        const referenced = await db.$client.execute({ sql: "SELECT 1 FROM media_assets WHERE id=? LIMIT 1", args: [mediaId] });
        if (!referenced.rows.length) await Promise.all([rm(paths.full, { force: true }), rm(paths.thumbnail, { force: true }), rm(paths.source, { force: true })]);
      }
      catch (cleanupError) { console.error("Unable to remove staged private image files", cleanupError); }
    }
    throw error;
  }
}

export async function replacePrimaryPhoto(context: InventoryContext, itemId: string, file: File, sourceFile: File = file, cropValue = "") {
  itemId = mediaIdSchema.parse(itemId);
  const { db, workspaceId } = await inventoryDatabase(context);
  const item = await db.$client.execute({ sql: "SELECT id FROM items WHERE id = ? AND workspace_id = ?", args: [itemId, workspaceId] });
  if (!item.rows.length) throw new Error("Вещь не найдена");
  return setPrimaryPhoto(context, itemId, await processImage(file, sourceFile, cropValue));
}

export async function getPrimaryPhoto(context: InventoryContext, itemId: string) {
  itemId = mediaIdSchema.parse(itemId);
  const { db, workspaceId } = await inventoryDatabase(context);
  const result = await db.$client.execute({
    sql: `SELECT m.id, m.width, m.height, m.created_at AS createdAt
          FROM media_assets m INNER JOIN items i ON i.id = m.item_id
          WHERE m.item_id = ? AND i.workspace_id = ? AND m.is_primary = 1 LIMIT 1`,
    args: [itemId, workspaceId],
  });
  return result.rows.length ? result.rows[0] as unknown as { id: string; width: number; height: number; createdAt: string } : null;
}

export async function readPrimaryPhoto(context: InventoryContext, itemId: string, mediaId: string, variantValue: string | null) {
  itemId = mediaIdSchema.parse(itemId);
  mediaId = mediaIdSchema.parse(mediaId);
  const variant: Variant = variantValue === "source" ? "source" : mediaVariantSchema.parse(variantValue ?? "image");
  const { db, workspaceId } = await inventoryDatabase(context);
  const result = await db.$client.execute({
    sql: `SELECT m.id, m.item_id, m.storage_path, m.thumbnail_path, m.source_storage_path
          FROM media_assets m INNER JOIN items i ON i.id = m.item_id
          WHERE m.item_id = ? AND m.id = ? AND i.workspace_id = ? AND m.is_primary = 1 LIMIT 1`,
    args: [itemId, mediaId, workspaceId],
  });
  if (!result.rows.length) return null;
  const record = result.rows[0] as unknown as StoredAsset;
  const paths = assertStoredPaths(record);
  return readFile(variant === "thumbnail" ? paths.thumbnail : variant === "source" && record.source_storage_path ? paths.source : paths.full);
}

export async function getNormalizedPhotoForAnalysis(context: InventoryContext, itemId: string) {
  const photo = await getPrimaryPhoto(context, itemId);
  if (!photo) return null;
  const buffer = await readPrimaryPhoto(context, itemId, photo.id, "image");
  if (!buffer) return null;
  return { buffer, mimeType: "image/webp" as const, width: photo.width, height: photo.height };
}

export async function removePrimaryPhoto(context: InventoryContext, itemId: string) {
  itemId = mediaIdSchema.parse(itemId);
  const { db, workspaceId } = await inventoryDatabase(context);
  const tx = await db.$client.transaction("write");
  let removed: StoredAsset[] = [];
  try {
    const result = await tx.execute({
      sql: `SELECT m.id, m.item_id, m.storage_path, m.thumbnail_path, m.source_storage_path
            FROM media_assets m INNER JOIN items i ON i.id = m.item_id
            WHERE m.item_id = ? AND i.workspace_id = ? AND m.is_primary = 1`,
      args: [itemId, workspaceId],
    });
    removed = result.rows as unknown as StoredAsset[];
    await tx.execute({ sql: "DELETE FROM media_assets WHERE item_id = ? AND is_primary = 1 AND EXISTS(SELECT 1 FROM items WHERE id=? AND workspace_id=?)", args: [itemId,itemId,workspaceId] });
    await tx.commit();
  } catch (error) { await tx.rollback(); throw error; }
  for (const asset of removed) {
    try { await removeAssetFiles(context, asset); }
    catch (error) { console.error("Unable to remove private image files after metadata removal", error); }
  }
  return removed.length > 0;
}

export async function deleteItemWithMedia(context: InventoryContext, itemId: string) {
  itemId = mediaIdSchema.parse(itemId);
  const { db, workspaceId } = await inventoryDatabase(context);
  const tx = await db.$client.transaction("write");
  let assets: StoredAsset[] = [];
  try {
    const item = await tx.execute({ sql: "SELECT id FROM items WHERE id = ? AND workspace_id = ?", args: [itemId, workspaceId] });
    if (!item.rows.length) { await tx.commit(); return; }
    const result = await tx.execute({
      sql: "SELECT id, item_id, storage_path, thumbnail_path, source_storage_path FROM media_assets WHERE item_id = ?",
      args: [itemId],
    });
    assets = result.rows as unknown as StoredAsset[];
    await tx.execute({ sql: "DELETE FROM stock_entries WHERE item_id = ?", args: [itemId] });
    await tx.execute({ sql: "DELETE FROM media_assets WHERE item_id = ?", args: [itemId] });
    await tx.execute({ sql: "DELETE FROM items WHERE id = ? AND workspace_id = ?", args: [itemId, workspaceId] });
    await tx.commit();
  } catch (error) { await tx.rollback(); throw error; }
  for (const asset of assets) {
    try { await removeAssetFiles(context, asset); }
    catch (error) { console.error("Unable to remove private image files after item deletion", error); }
  }
}
