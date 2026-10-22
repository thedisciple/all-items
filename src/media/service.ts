import sharp, { type Metadata } from "sharp";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { dataDirectory, initializeWorkspace } from "@/db/client";
import { createItem, deleteItem, type ItemFields } from "@/items/service";

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
type Variant = z.infer<typeof mediaVariantSchema>;
type AssetPaths = { full: string; thumbnail: string; relativeFull: string; relativeThumbnail: string };
type StoredAsset = { id: string; item_id: string; storage_path: string; thumbnail_path: string };

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
  const full = path.resolve(root, safeItemId, `${safeMediaId}.webp`);
  const thumbnail = path.resolve(root, safeItemId, `${safeMediaId}-thumb.webp`);
  for (const resolved of [full, thumbnail]) {
    const relative = path.relative(root, resolved);
    if (relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
      throw new Error("Unsafe media path");
    }
  }
  return { full, thumbnail, relativeFull, relativeThumbnail };
}

function assertStoredPaths(row: StoredAsset) {
  const paths = assetPaths(row.item_id, row.id);
  if (row.storage_path !== paths.relativeFull || row.thumbnail_path !== paths.relativeThumbnail) {
    throw new Error("Stored media path does not match its generated identifier");
  }
  return paths;
}

async function removeAssetFiles(row: StoredAsset) {
  const paths = assertStoredPaths(row);
  await Promise.all([rm(paths.full, { force: true }), rm(paths.thumbnail, { force: true })]);
}

async function processImage(file: File) {
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
    const originalFilename = path.basename(file.name.replace(/\\/g, "/"))
      .replace(/[\u0000-\u001f\u007f]/g, "").slice(0, 255) || "photo";
    return { full: normalized.data, thumbnail, width: normalized.info.width, height: normalized.info.height, originalFilename };
  } catch {
    throw new MediaValidationError("Фотографию не удалось обработать. Попробуйте другой файл.");
  }
}

async function writeAssetFiles(itemId: string, mediaId: string, image: Awaited<ReturnType<typeof processImage>>) {
  const paths = assetPaths(itemId, mediaId);
  await mkdir(path.dirname(paths.full), { recursive: true });
  try {
    await writeFile(paths.full, image.full, { flag: "wx" });
    await writeFile(paths.thumbnail, image.thumbnail, { flag: "wx" });
  } catch (error) {
    await Promise.all([rm(paths.full, { force: true }), rm(paths.thumbnail, { force: true })]);
    throw error;
  }
  return paths;
}

async function setPrimaryPhoto(itemId: string, image: Awaited<ReturnType<typeof processImage>>) {
  const { db, workspaceId } = await initializeWorkspace();
  const mediaId = crypto.randomUUID();
  const paths = await writeAssetFiles(itemId, mediaId, image);
  const newAsset = { id: mediaId, item_id: itemId, storage_path: paths.relativeFull, thumbnail_path: paths.relativeThumbnail };
  const tx = await db.$client.transaction("write").catch(async (error: unknown) => {
    try { await removeAssetFiles(newAsset); }
    catch (cleanupError) { console.error("Unable to remove staged private image files", cleanupError); }
    throw error;
  });
  let previous: StoredAsset[] = [];
  try {
    const existing = await tx.execute({ sql: "SELECT id, item_id, storage_path, thumbnail_path FROM media_assets WHERE item_id = ? AND is_primary = 1", args: [itemId] });
    previous = existing.rows as unknown as StoredAsset[];
    const item = await tx.execute({ sql: "SELECT id FROM items WHERE id = ? AND workspace_id = ?", args: [itemId, workspaceId] });
    if (!item.rows.length) throw new Error("Вещь не найдена");
    await tx.execute({ sql: "DELETE FROM media_assets WHERE item_id = ? AND is_primary = 1", args: [itemId] });
    await tx.execute({
      sql: `INSERT INTO media_assets (id, item_id, storage_path, thumbnail_path, original_filename, mime_type, width, height, created_at, is_primary)
            VALUES (?, ?, ?, ?, ?, 'image/webp', ?, ?, ?, 1)`,
      args: [mediaId, itemId, paths.relativeFull, paths.relativeThumbnail, image.originalFilename, image.width, image.height, new Date().toISOString()],
    });
    await tx.commit();
  } catch (error) {
    await tx.rollback();
    try { await removeAssetFiles(newAsset); }
    catch (cleanupError) { console.error("Unable to remove staged private image files", cleanupError); }
    throw error;
  }
  for (const oldAsset of previous) {
    try { await removeAssetFiles(oldAsset); }
    catch (error) { console.error("Unable to remove replaced private image files", error); }
  }
  return { id: mediaId, width: image.width, height: image.height, createdAt: new Date().toISOString() };
}

export async function createItemWithPhoto(input: ItemFields, file: File) {
  const image = await processImage(file);
  const item = await createItem(input);
  try {
    await setPrimaryPhoto(item.id, image);
    return item;
  } catch (error) {
    try { await deleteItem(item.id); }
    catch (cleanupError) { console.error("Unable to compensate for failed photo-first item creation", cleanupError); }
    throw error;
  }
}

export async function replacePrimaryPhoto(itemId: string, file: File) {
  itemId = mediaIdSchema.parse(itemId);
  const { db, workspaceId } = await initializeWorkspace();
  const item = await db.$client.execute({ sql: "SELECT id FROM items WHERE id = ? AND workspace_id = ?", args: [itemId, workspaceId] });
  if (!item.rows.length) throw new Error("Вещь не найдена");
  return setPrimaryPhoto(itemId, await processImage(file));
}

export async function getPrimaryPhoto(itemId: string) {
  itemId = mediaIdSchema.parse(itemId);
  const { db, workspaceId } = await initializeWorkspace();
  const result = await db.$client.execute({
    sql: `SELECT m.id, m.width, m.height, m.created_at AS createdAt
          FROM media_assets m INNER JOIN items i ON i.id = m.item_id
          WHERE m.item_id = ? AND i.workspace_id = ? AND m.is_primary = 1 LIMIT 1`,
    args: [itemId, workspaceId],
  });
  return result.rows.length ? result.rows[0] as unknown as { id: string; width: number; height: number; createdAt: string } : null;
}

export async function readPrimaryPhoto(itemId: string, mediaId: string, variantValue: string | null) {
  itemId = mediaIdSchema.parse(itemId);
  mediaId = mediaIdSchema.parse(mediaId);
  const variant: Variant = mediaVariantSchema.parse(variantValue ?? "image");
  const { db, workspaceId } = await initializeWorkspace();
  const result = await db.$client.execute({
    sql: `SELECT m.id, m.item_id, m.storage_path, m.thumbnail_path
          FROM media_assets m INNER JOIN items i ON i.id = m.item_id
          WHERE m.item_id = ? AND m.id = ? AND i.workspace_id = ? AND m.is_primary = 1 LIMIT 1`,
    args: [itemId, mediaId, workspaceId],
  });
  if (!result.rows.length) return null;
  const record = result.rows[0] as unknown as StoredAsset;
  const paths = assertStoredPaths(record);
  return readFile(variant === "thumbnail" ? paths.thumbnail : paths.full);
}

export async function getNormalizedPhotoForAnalysis(itemId: string) {
  const photo = await getPrimaryPhoto(itemId);
  if (!photo) return null;
  const buffer = await readPrimaryPhoto(itemId, photo.id, "image");
  if (!buffer) return null;
  return { buffer, mimeType: "image/webp" as const, width: photo.width, height: photo.height };
}

export async function removePrimaryPhoto(itemId: string) {
  itemId = mediaIdSchema.parse(itemId);
  const { db, workspaceId } = await initializeWorkspace();
  const tx = await db.$client.transaction("write");
  let removed: StoredAsset[] = [];
  try {
    const result = await tx.execute({
      sql: `SELECT m.id, m.item_id, m.storage_path, m.thumbnail_path
            FROM media_assets m INNER JOIN items i ON i.id = m.item_id
            WHERE m.item_id = ? AND i.workspace_id = ? AND m.is_primary = 1`,
      args: [itemId, workspaceId],
    });
    removed = result.rows as unknown as StoredAsset[];
    await tx.execute({ sql: "DELETE FROM media_assets WHERE item_id = ? AND is_primary = 1", args: [itemId] });
    await tx.commit();
  } catch (error) { await tx.rollback(); throw error; }
  for (const asset of removed) {
    try { await removeAssetFiles(asset); }
    catch (error) { console.error("Unable to remove private image files after metadata removal", error); }
  }
  return removed.length > 0;
}

export async function deleteItemWithMedia(itemId: string) {
  itemId = mediaIdSchema.parse(itemId);
  const { db, workspaceId } = await initializeWorkspace();
  const tx = await db.$client.transaction("write");
  let assets: StoredAsset[] = [];
  try {
    const item = await tx.execute({ sql: "SELECT id FROM items WHERE id = ? AND workspace_id = ?", args: [itemId, workspaceId] });
    if (!item.rows.length) { await tx.commit(); return; }
    const result = await tx.execute({
      sql: "SELECT id, item_id, storage_path, thumbnail_path FROM media_assets WHERE item_id = ?",
      args: [itemId],
    });
    assets = result.rows as unknown as StoredAsset[];
    await tx.execute({ sql: "DELETE FROM stock_entries WHERE item_id = ?", args: [itemId] });
    await tx.execute({ sql: "DELETE FROM media_assets WHERE item_id = ?", args: [itemId] });
    await tx.execute({ sql: "DELETE FROM items WHERE id = ? AND workspace_id = ?", args: [itemId, workspaceId] });
    await tx.commit();
  } catch (error) { await tx.rollback(); throw error; }
  for (const asset of assets) {
    try { await removeAssetFiles(asset); }
    catch (error) { console.error("Unable to remove private image files after item deletion", error); }
  }
}
