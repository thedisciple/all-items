import { assertPrivatePath } from "@/media/private-paths";
import sharp, { type Metadata } from "sharp";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import {createHash} from "node:crypto";
import { z } from "zod";
import { dataDirectory } from "@/db/client";
import { inventoryDatabase } from "@/items/inventories";
import type { InventoryContext } from "@/items/inventory-context";
import { createItem, type ItemFields } from "@/items/service";
import { cropDataSchema } from "@/media/crop-data";
import { NEW_ITEM_PHOTO_LIMIT, PhotoLimitError } from "./limits";
import {canonicalJSON,safePhotoName} from "@/items/creation-command";
import {insertWriteReceipt,readWriteReceipt,WriteReceiptDeleted,type WriteIdentity} from "@/items/write-receipts";

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
export class MediaProcessingBusy extends Error{constructor(){super("Photo processing is busy");}}
const processingState=globalThis as typeof globalThis&{__allItemsImageQueue?:{tail:Promise<unknown>;count:number}};

async function processImage(file:File,sourceFile:File=file,cropValue="",keepEditableSource=true){
  const selected=uploadedFileSchema.safeParse(file),source=uploadedFileSchema.safeParse(sourceFile);
  if(!selected.success)throw new MediaValidationError(selected.error.issues[0]?.message??"Invalid photo input size");
  if(!source.success)throw new MediaValidationError("Invalid editable source size");
  const queue=processingState.__allItemsImageQueue??={tail:Promise.resolve(),count:0};
  if(queue.count>=4)throw new MediaProcessingBusy();
  queue.count++;
  const operation=queue.tail.then(()=>normalizeImage(file,sourceFile,cropValue,keepEditableSource));
  queue.tail=operation.catch(()=>{});
  try{return await operation;}finally{queue.count--;}
}

function mediaRoot(directory=dataDirectory()) {
  return path.resolve(directory, "media", "items");
}

function assetPaths(itemId: string, mediaId: string, directory=dataDirectory()): AssetPaths {
  const safeItemId = mediaIdSchema.parse(itemId);
  const safeMediaId = mediaIdSchema.parse(mediaId);
  const root = mediaRoot(directory);
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
  if (live.rows.length) throw new Error("Refusing to remove referenced photo files");
  const paths = assertStoredPaths(row);
  for(const file of [paths.full,paths.thumbnail,paths.source]) await assertPrivatePath(dataDirectory(),file);
  await Promise.all([rm(paths.full, { force: true }), rm(paths.thumbnail, { force: true }), rm(paths.source, { force: true })]);
}

async function normalizeImage(file: File, sourceFile: File = file, cropValue = "", keepEditableSource = true) {
  const validFile = uploadedFileSchema.safeParse(file);
  if (!validFile.success) throw new MediaValidationError(validFile.error.issues[0]?.message ?? "Файл фотографии недопустим.");
  const validSource = uploadedFileSchema.safeParse(sourceFile);
  if (!validSource.success) throw new MediaValidationError("Invalid editable source size");
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

export async function normalizeItemPhoto(file:File,source:File=file,crop=""){
  return processImage(file,source,crop);
}
export const privateItemAssetPaths=assetPaths;

async function writeAssetFiles(itemId: string, mediaId: string, image: Awaited<ReturnType<typeof processImage>>) {
  const paths = assetPaths(itemId, mediaId);
  for(const file of [paths.full,paths.thumbnail,paths.source]) await assertPrivatePath(dataDirectory(),file);
  await mkdir(path.dirname(paths.full), { recursive: true });
  const created:string[]=[];
  try {
    for(const [file,bytes]of [[paths.full,image.full],[paths.thumbnail,image.thumbnail],[paths.source,image.source]] as const){
      await writeFile(file,bytes,{flag:"wx"});created.push(file);
    }
  } catch (error) {
    await Promise.all(created.map(file=>rm(file,{force:true})));
    throw error;
  }
  return paths;
}

type GalleryRow = StoredAsset & { is_primary: number; display_order: number; width: number; height: number; created_at: string; crop_data: string | null };

type MediaTransaction = Awaited<ReturnType<Awaited<ReturnType<typeof inventoryDatabase>>["db"]["$client"]["transaction"]>>;

async function galleryWrite<T>(context: InventoryContext, itemId: string, operation: (tx: MediaTransaction, rows: GalleryRow[]) => Promise<T>) {
  mediaIdSchema.parse(itemId);
  const { db, workspaceId } = await inventoryDatabase(context);
  let tx: MediaTransaction;
  for (let attempt = 0; ; attempt++) {
    try { tx = await db.$client.transaction("write"); break; }
    catch (error) {
      if (!(error instanceof Error) || !error.message.includes("SQLITE_BUSY") || attempt >= 8) throw error;
      await new Promise(resolve => setTimeout(resolve, Math.min(10 * 2 ** attempt, 250)));
    }
  }
  try {
    const owner = await tx.execute({ sql: "SELECT id FROM items WHERE id=? AND workspace_id=?", args: [itemId, workspaceId] });
    if (!owner.rows.length) throw new Error("Item not found");
    const result = await tx.execute({ sql: "SELECT * FROM media_assets WHERE item_id=? ORDER BY display_order,id", args: [itemId] });
    const value = await operation(tx, result.rows as unknown as GalleryRow[]);
    const check = await tx.execute({ sql: "SELECT COUNT(*) AS count,COALESCE(SUM(is_primary),0) AS primaries,COUNT(DISTINCT display_order) AS positions FROM media_assets WHERE item_id=?", args: [itemId] });
    const row = check.rows[0]!;
    if (Number(row.primaries) !== (Number(row.count) ? 1 : 0) || row.count !== row.positions) throw new Error("Invalid photo gallery");
    await tx.commit();
    return value;
  } catch (error) { await tx.rollback(); throw error; }
}

async function assignPhotoOrder(tx: MediaTransaction, rows: GalleryRow[], ids: string[]) {
  const offset = Math.max(0, ...rows.map(row => row.display_order)) + rows.length + 1;
  for (const row of rows) await tx.execute({ sql: "UPDATE media_assets SET display_order=? WHERE id=?", args: [row.display_order + offset, row.id] });
  for (const [index, id] of ids.entries()) await tx.execute({ sql: "UPDATE media_assets SET display_order=? WHERE id=?", args: [index, id] });
}

async function photoWriteIdentity(itemId:string,file:File,source:File,cropValue:string,operationId?:string,replaceId?:string):Promise<WriteIdentity|undefined>{
  if(!operationId)return undefined;
  mediaIdSchema.parse(operationId);
  const descriptor=async(input:File)=>{
    if(!uploadedFileSchema.safeParse(input).success)throw new MediaValidationError("Invalid photo write input");
    return{sha256:createHash("sha256").update(new Uint8Array(await input.arrayBuffer())).digest("hex"),size:input.size,name:safePhotoName(input.name),type:input.type};
  };
  const selected=await descriptor(file),original=source===file?selected:await descriptor(source);
  const crop=cropValue?cropDataSchema.parse(JSON.parse(cropValue)):null;
  const kind=replaceId?"photo_replace":"photo_add";
  return{operationId,kind,requestHash:createHash("sha256").update(canonicalJSON({kind,itemId,mediaId:replaceId??null,selected,source:original,crop})).digest("hex")};
}
async function savedPhotoResult(context:InventoryContext,itemId:string,mediaId:string){
  const {db,workspaceId}=await inventoryDatabase(context);
  const result=await db.$client.execute({sql:"SELECT m.id,m.width,m.height,m.created_at FROM media_assets m JOIN items i ON i.id=m.item_id WHERE m.id=? AND i.id=? AND i.workspace_id=?",args:[mediaId,itemId,workspaceId]});
  const row=result.rows[0];if(!row)throw new WriteReceiptDeleted(itemId);
  return{id:String(row.id),width:Number(row.width),height:Number(row.height),createdAt:String(row.created_at)};
}

async function persistItemPhoto(context: InventoryContext, itemId: string, image: Awaited<ReturnType<typeof processImage>>, replaceId?: string,write?:WriteIdentity) {
  mediaIdSchema.parse(itemId);
  if (replaceId) mediaIdSchema.parse(replaceId);
  const { db, workspaceId } = await inventoryDatabase(context);
  const owner = await db.$client.execute({ sql: "SELECT id FROM items WHERE id=? AND workspace_id=?", args: [itemId, workspaceId] });
  if (!owner.rows.length) throw new Error("Item not found");
  const prior=write?await readWriteReceipt(db.$client,context,write):null;
  if(prior)return savedPhotoResult(context,itemId,prior.mediaId!);
  const mediaId = crypto.randomUUID();
  const paths = await writeAssetFiles(itemId, mediaId, image);
  const newAsset = { id: mediaId, item_id: itemId, storage_path: paths.relativeFull, thumbnail_path: paths.relativeThumbnail, source_storage_path: paths.relativeSource };
  let previous: GalleryRow | undefined;
  let savedId=mediaId;
  try {
    savedId=await galleryWrite(context, itemId, async (tx, rows) => {
      const acknowledged=write?await readWriteReceipt(tx,context,write):null;
      if(acknowledged)return acknowledged.mediaId!;
      if (!replaceId && rows.length >= NEW_ITEM_PHOTO_LIMIT) throw new PhotoLimitError("Photo addition limit reached");
      previous = replaceId ? rows.find(row => row.id === replaceId) : undefined;
      if (replaceId && !previous) throw new Error("Photo not found");
      const end = Math.max(-1, ...rows.map(row => row.display_order)) + 1;
      const position = previous?.display_order ?? end;
      const primary = previous ? Number(previous.is_primary) : rows.length ? 0 : 1;
      if (previous) await tx.execute({ sql: "UPDATE media_assets SET display_order=?,is_primary=0 WHERE id=?", args: [end, previous.id] });
      await tx.execute({
        sql: "INSERT INTO media_assets(id,item_id,storage_path,thumbnail_path,source_storage_path,crop_data,original_filename,mime_type,width,height,created_at,is_primary,display_order) VALUES(?,?,?,?,?,?,?,'image/webp',?,?,?,?,?)",
        args: [mediaId,itemId,paths.relativeFull,paths.relativeThumbnail,paths.relativeSource,image.cropData,image.originalFilename,image.width,image.height,new Date().toISOString(),primary,position],
      });
      if (previous) {
        // The replacement is durable before references move; siblings retain identity and bytes.
        await tx.execute({ sql: "UPDATE collections SET cover_media_id=? WHERE cover_media_id=? AND workspace_id=? AND cover_item_id=?", args: [mediaId,previous.id,workspaceId,itemId] });
        await tx.execute({ sql: "DELETE FROM media_assets WHERE id=?", args: [previous.id] });
      }
      if(write){const item=(await tx.execute({sql:"SELECT inventory_number FROM items WHERE id=? AND workspace_id=?",args:[itemId,workspaceId]})).rows[0]!;await insertWriteReceipt(tx,context,write,{itemId,mediaId,inventoryNumber:String(item.inventory_number)});}
      return mediaId;
    });
  } catch (error) {
    let acknowledged:null|Awaited<ReturnType<typeof readWriteReceipt>>=null;
    if(write)try{acknowledged=await readWriteReceipt(db.$client,context,write);}catch{/* Cleanup still checks live references; ambiguity preserves files. */}
    if(acknowledged)savedId=acknowledged.mediaId!;
    else{try { await removeAssetFiles(context, newAsset); } catch { /* Preserve a referenced asset after an ambiguous commit acknowledgement. */ }throw error;}
  }
  if(savedId!==mediaId)try{await removeAssetFiles(context,newAsset);}catch{console.error("Duplicate photo preparation cleanup remains pending");}
  if (previous) try { await removeAssetFiles(context, previous); } catch { console.error("Private photo cleanup remains pending after replacement"); }
  return savedPhotoResult(context,itemId,savedId);
}

export async function addItemPhoto(context: InventoryContext, itemId: string, file: File, sourceFile: File = file, cropValue = "",operationId?:string) {
  mediaIdSchema.parse(itemId);
  const { db, workspaceId } = await inventoryDatabase(context);
  const count = await db.$client.execute({sql:"SELECT COUNT(m.id) AS count FROM items i LEFT JOIN media_assets m ON m.item_id=i.id WHERE i.id=? AND i.workspace_id=? GROUP BY i.id",args:[itemId,workspaceId]});
  if (!count.rows.length) throw new Error("Item not found");
  const write=await photoWriteIdentity(itemId,file,sourceFile,cropValue,operationId);
  const prior=write?await readWriteReceipt(db.$client,context,write):null;
  if(prior)return savedPhotoResult(context,itemId,prior.mediaId!);
  if (Number(count.rows[0]!.count) >= NEW_ITEM_PHOTO_LIMIT) throw new PhotoLimitError("Photo addition limit reached");
  return persistItemPhoto(context, itemId, await processImage(file, sourceFile, cropValue),undefined,write);
}

export async function replaceItemPhoto(context: InventoryContext, itemId: string, mediaId: string, file: File, sourceFile: File = file, cropValue = "",operationId?:string) {
  mediaIdSchema.parse(itemId);mediaIdSchema.parse(mediaId);
  const {db,workspaceId}=await inventoryDatabase(context);
  const owner=await db.$client.execute({sql:"SELECT id FROM items WHERE id=? AND workspace_id=?",args:[itemId,workspaceId]});if(!owner.rows.length)throw new Error("Item not found");
  const write=await photoWriteIdentity(itemId,file,sourceFile,cropValue,operationId,mediaId);
  const prior=write?await readWriteReceipt(db.$client,context,write):null;if(prior)return savedPhotoResult(context,itemId,prior.mediaId!);
  const target=await db.$client.execute({sql:"SELECT id FROM media_assets WHERE item_id=? AND id=?",args:[itemId,mediaId]});if(!target.rows.length)throw new Error("Photo not found");
  return persistItemPhoto(context, itemId, await processImage(file, sourceFile, cropValue), mediaId,write);
}

export async function setItemPrimaryPhoto(context: InventoryContext, itemId: string, mediaId: string) {
  mediaIdSchema.parse(mediaId);
  return galleryWrite(context, itemId, async (tx, rows) => {
    if (!rows.some(row => row.id === mediaId)) throw new Error("Photo not found");
    await tx.execute({ sql: "UPDATE media_assets SET is_primary=0 WHERE item_id=? AND is_primary=1", args: [itemId] });
    await tx.execute({ sql: "UPDATE media_assets SET is_primary=1 WHERE id=? AND item_id=?", args: [mediaId,itemId] });
  });
}

export async function reorderItemPhotos(context: InventoryContext, itemId: string, value: unknown) {
  const ids = z.array(mediaIdSchema).max(20_000).parse(value);
  return galleryWrite(context, itemId, async (tx, rows) => {
    if (new Set(ids).size !== ids.length || ids.length !== rows.length || ids.some(id => !rows.some(row => row.id === id))) throw new Error("Photo gallery changed");
    await assignPhotoOrder(tx, rows, ids);
  });
}

export async function removeItemPhoto(context: InventoryContext, itemId: string, mediaId: string) {
  mediaIdSchema.parse(mediaId);
  const removed = await galleryWrite(context, itemId, async (tx, rows) => {
    const target = rows.find(row => row.id === mediaId);
    if (!target) throw new Error("Photo not found");
    const survivors = rows.filter(row => row.id !== mediaId);
    await tx.execute({ sql: "DELETE FROM media_assets WHERE id=? AND item_id=?", args: [mediaId,itemId] });
    if (target.is_primary && survivors.length) await tx.execute({ sql: "UPDATE media_assets SET is_primary=1 WHERE id=?", args: [survivors[0]!.id] });
    await assignPhotoOrder(tx, survivors, survivors.map(row => row.id));
    // The existing deletion trigger resets covers referencing exactly this photo.
    return target;
  });
  try { await removeAssetFiles(context, removed); } catch { console.error("Private photo cleanup remains pending after deletion"); }
  return true;
}

export type ItemPhotoDTO = { id: string; isPrimary: boolean; displayOrder: number; width: number; height: number; createdAt: string; crop: z.infer<typeof cropDataSchema> | null };
export async function listItemPhotos(context: InventoryContext, itemId: string): Promise<ItemPhotoDTO[]> {
  mediaIdSchema.parse(itemId);
  const { db, workspaceId } = await inventoryDatabase(context);
  const result = await db.$client.execute({ sql: "SELECT m.* FROM media_assets m JOIN items i ON i.id=m.item_id WHERE m.item_id=? AND i.workspace_id=? ORDER BY m.display_order,m.id", args: [itemId,workspaceId] });
  return result.rows.map(row => ({ id: String(row.id), isPrimary: Boolean(row.is_primary), displayOrder: Number(row.display_order), width: Number(row.width), height: Number(row.height), createdAt: String(row.created_at), crop: row.crop_data ? cropDataSchema.parse(JSON.parse(String(row.crop_data))) : null }));
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
  const primary = await getPrimaryPhoto(context, itemId);
  return primary ? replaceItemPhoto(context, itemId, primary.id, file, sourceFile, cropValue) : addItemPhoto(context, itemId, file, sourceFile, cropValue);
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

export async function readItemPhoto(context: InventoryContext, itemId: string, mediaId: string, variantValue: string | null) {
  itemId = mediaIdSchema.parse(itemId);
  mediaId = mediaIdSchema.parse(mediaId);
  const variant: Variant = variantValue === "source" ? "source" : mediaVariantSchema.parse(variantValue ?? "image");
  const { db, workspaceId } = await inventoryDatabase(context);
  const result = await db.$client.execute({
    sql: `SELECT m.id, m.item_id, m.storage_path, m.thumbnail_path, m.source_storage_path
          FROM media_assets m INNER JOIN items i ON i.id = m.item_id
          WHERE m.item_id = ? AND m.id = ? AND i.workspace_id = ? LIMIT 1`,
    args: [itemId, mediaId, workspaceId],
  });
  if (!result.rows.length) return null;
  const record = result.rows[0] as unknown as StoredAsset;
  const paths = assertStoredPaths(record);
  const target = variant === "thumbnail" ? paths.thumbnail : variant === "source" && record.source_storage_path ? paths.source : paths.full;
  await assertPrivatePath(dataDirectory(), target);
  return readFile(target);
}

export async function getNormalizedPhotoForAnalysis(context: InventoryContext, itemId: string) {
  const photo = await getPrimaryPhoto(context, itemId);
  if (!photo) return null;
  const buffer = await readPrimaryPhoto(context, itemId, photo.id, "image");
  if (!buffer) return null;
  return { buffer, mimeType: "image/webp" as const, width: photo.width, height: photo.height };
}

export async function removePrimaryPhoto(context: InventoryContext, itemId: string) {
  const primary = await getPrimaryPhoto(context, itemId);
  return primary ? removeItemPhoto(context, itemId, primary.id) : false;
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

// Compatibility for internal callers; the controlled route now serves every owned gallery photo.
export const readPrimaryPhoto = readItemPhoto;
