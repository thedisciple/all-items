import { assertPrivatePath } from "@/media/private-paths";
import { withInventoryOperation } from "@/items/operation-lock";
import { assertUniqueInventoryName, inventoryName } from "@/items/inventories";
import type { InventoryContext } from "@/items/inventory-context";
import { type Client, type InValue } from "@libsql/client";
import { createHash, randomUUID } from "node:crypto";
import { lstat, mkdir, open, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp, { type Metadata } from "sharp";
import { z } from "zod";
import { canonicalCategories } from "@/items/categories";
import { portablePreferences, categoryPresentations } from "@/items/inventory-presentation";
import { cropDataSchema } from "@/media/crop-data";
import { readInventoryArchive } from "./archive";

import { ORIGINAL_INVENTORY_ID } from "@/items/inventory-context";
const id = z.string().uuid();
const nullableText = z.string().nullable();
const timestamp = z.string().min(1).max(100);
const locationSchema = z.object({ id, workspace_id: id, name: z.string().min(1).max(120), created_at: timestamp });
const stockSchema = z.object({ id, item_id: id, location_id: id.nullable(), quantity: z.number().int().min(0).max(1_000_000), created_at: timestamp, updated_at: timestamp });
const mediaSchema = z.object({ id, isPrimary: z.boolean(), displayOrder: z.number().int().nonnegative(), originalFilename: z.string().max(255), mimeType: z.literal("image/webp"), width: z.number().int().positive().max(12_000), height: z.number().int().positive().max(12_000), cropData: nullableText, createdAt: timestamp, imagePath: z.string(), thumbnailPath: z.string(), sourcePath: z.string().nullable() });
const itemSchema = z.object({
  primaryMediaId: id.nullable(),
  id, workspace_id: id, inventory_number: z.string().regex(/^INV-\d{6,}$/), name: z.string().max(160), model: z.string().max(160).nullable(), brand: z.string().max(120).nullable(),
  category: z.string().max(80).nullable(), categories: z.array(z.string().min(1).max(80)).max(20), original_marking:z.string().max(160).nullable(), notes:z.string().max(2000).nullable(), description:z.string().max(4000).nullable(),
  identification_status: z.enum(["unknown", "user_confirmed", "source_verified"]), tracking_mode: z.enum(["unique", "bulk", "consumable"]),
  sale_intent: z.enum(["not_for_sale", "considering", "willing_to_sell"]), asking_price_minor: z.number().int().nonnegative().nullable(), asking_currency: nullableText,
  created_at: timestamp, updated_at: timestamp, stock: z.array(stockSchema).min(1).max(50), collectionIds: z.array(id), mediaAssets: z.array(mediaSchema),
});
const coverSchema = z.object({ id, width: z.number().int().positive().max(12_000), height: z.number().int().positive().max(12_000), createdAt: timestamp, path: z.string(), thumbnailPath: z.string() });
const collectionSchema = z.object({
  id, workspace_id: id, name: z.string().trim().min(1).max(120), normalized_name: z.string().min(1), created_at: timestamp, updated_at: timestamp,
  icon: nullableText, cover_type: z.enum(["item_photo", "upload", "emoji", "default"]).nullable(), cover_icon: nullableText,
  cover_item_id: id.nullable(), cover_media_id: id.nullable(), cover_upload_id: id.nullable(), itemIds: z.array(id), uploadCover: coverSchema.nullable(),
});
const membershipSchema = z.object({ id, item_id: id, collection_id: id, created_at: timestamp });
const inventorySchema = z.object({ workspace: z.object({ id: id, name: z.string(), created_at: timestamp, next_inventory_number: z.number().int().positive() }), preferences: portablePreferences, customCategories: categoryPresentations, locations: z.array(locationSchema), items: z.array(itemSchema), collections: z.array(collectionSchema), memberships: z.array(membershipSchema) });
export type PortableInventory = z.infer<typeof inventorySchema>;
type Promotion = { archivePath: string; relativePath: string };
type Executor = Pick<Client, "execute">;
export type ImportPreview = { name: string; items: number; collections: number; photos: number; exportedAt: string };

export class ImportError extends Error { constructor(message: string, public code: "invalid" | "occupied" | "failed" = "invalid") { super(message); this.name = "ImportError"; } }

function validatedRecords(value: unknown): PortableInventory {
  const result = inventorySchema.safeParse(value);
  if (!result.success) throw new ImportError("The archive contains invalid inventory records.");
  const inventory = result.data;
  if ([...inventory.items,...inventory.locations,...inventory.collections].some(row=>row.workspace_id!==inventory.workspace.id)) throw new ImportError("Records cross the archived inventory boundary.");
  const itemIds = new Set<string>();
  const numbers = new Set<string>();
  const locationIds = new Set<string>();
  const stockIds = new Set<string>();
  const mediaIds = new Set<string>();
  const collectionIds = new Set<string>();
  const coverIds = new Set<string>();
  const membershipIds = new Set<string>();
  const locationNames = new Set<string>();
  const collectionNames = new Set<string>();
  let largestNumber = 0;
  for (const location of inventory.locations) {
    if (locationIds.has(location.id) || locationNames.has(location.name)) throw new ImportError("The archive contains duplicate locations.");
    locationIds.add(location.id); locationNames.add(location.name);
  }
  for (const item of inventory.items) {
    if (itemIds.has(item.id) || numbers.has(item.inventory_number)) throw new ImportError("The archive contains duplicate items.");
    itemIds.add(item.id); numbers.add(item.inventory_number);
    if (item.categories.some(value => !value.trim()) || new Set(item.categories).size !== item.categories.length) throw new ImportError("Duplicate or empty category assignments.");
    largestNumber = Math.max(largestNumber, Number(item.inventory_number.slice(4)));
    const stockLocations = new Set<string>();
    let total = 0;
    for (const stock of item.stock) {
      if (stockIds.has(stock.id) || stock.item_id !== item.id || stock.location_id && !locationIds.has(stock.location_id) || stockLocations.has(stock.location_id ?? "")) throw new ImportError("The archive contains invalid stock locations.");
      stockIds.add(stock.id); stockLocations.add(stock.location_id ?? ""); total += stock.quantity;
    }
    if (item.tracking_mode === "unique" && total !== 1) throw new ImportError("A unique item must have quantity one.");
    let primaryCount = 0;
    for (const [position, media] of item.mediaAssets.entries()) {
      if (media.displayOrder !== position) throw new ImportError("Invalid photo ordering.");
      if (mediaIds.has(media.id)) throw new ImportError("The archive contains duplicate photographs.");
      mediaIds.add(media.id);
      if (media.isPrimary) primaryCount++;
      if (media.cropData !== null) {
        try { cropDataSchema.parse(JSON.parse(media.cropData)); }
        catch { throw new ImportError("The archive contains invalid crop data."); }
      }
    }
    if (item.primaryMediaId !== (item.mediaAssets.find(media => media.isPrimary)?.id ?? null)) throw new ImportError("Invalid primary photo identity.");
    if (item.mediaAssets.length && primaryCount !== 1) throw new ImportError("An item has invalid primary photograph information.");
  }
  if (!Number.isSafeInteger(largestNumber) || inventory.workspace.next_inventory_number <= largestNumber) throw new ImportError("The archive has an invalid inventory-number sequence.");
  for (const collection of inventory.collections) {
    if (collectionIds.has(collection.id) || collectionNames.has(collection.normalized_name) || collection.normalized_name !== collection.name.normalize("NFKC").toLocaleLowerCase("ru-RU")) throw new ImportError("The archive contains duplicate or invalid collections.");
    collectionIds.add(collection.id); collectionNames.add(collection.normalized_name);
    if (collection.cover_type === "upload" && (!collection.uploadCover || collection.cover_upload_id !== collection.uploadCover.id)) throw new ImportError("A collection cover reference is invalid.");
    if (collection.uploadCover) {
      if (coverIds.has(collection.uploadCover.id)) throw new ImportError("The archive contains duplicate collection covers.");
      coverIds.add(collection.uploadCover.id);
    }
  }
  for (const membership of inventory.memberships) {
    if (membershipIds.has(membership.id) || !itemIds.has(membership.item_id) || !collectionIds.has(membership.collection_id)) throw new ImportError("The archive contains an invalid collection membership.");
    membershipIds.add(membership.id);
  }
  return inventory;
}

async function validateImage(bytes: Uint8Array, expected?: { width: number; height: number }) {
  let metadata: Metadata;
  try {
    metadata = await sharp(bytes, { failOn: "error", limitInputPixels: 40_000_000, pages: 1 }).metadata();
    if (metadata.format !== "webp" || !metadata.width || !metadata.height || metadata.width > 12_000 || metadata.height > 12_000 || metadata.width * metadata.height > 40_000_000 || metadata.exif || metadata.icc || metadata.xmp || metadata.iptc || metadata.comments?.length) throw new Error("invalid-image");
    if (expected && (metadata.width !== expected.width || metadata.height !== expected.height)) throw new Error("wrong-dimensions");
    await sharp(bytes, { failOn: "error", limitInputPixels: 40_000_000, pages: 1 }).resize(1, 1).toBuffer();
  } catch { throw new ImportError("The archive contains an invalid photograph."); }
}

async function validatedArchive(input: Uint8Array) {
  const { manifest, inventory: untyped, files } = readInventoryArchive(input);
  const records = manifest.version === 2 ? { ...untyped, items: (untyped.items as Array<Record<string, unknown>>).map(item => ({ ...item, categories: canonicalCategories(typeof item.category === "string" ? [item.category] : []) })) } : untyped;
  const adapted = manifest.version < 6 ? { ...records, items: (records.items as Array<Record<string, unknown>>).map(item => {
    const media = item.mediaAssets as Array<Record<string, unknown>>;
    return { ...item, primaryMediaId: media.find(photo => photo.isPrimary)?.id ?? null, mediaAssets: media.map((photo, displayOrder) => ({ ...photo, displayOrder })) };
  }) } : records;
  const inventory = validatedRecords(adapted);
  if (manifest.version < 4 && inventory.workspace.id !== ORIGINAL_INVENTORY_ID) throw new ImportError("Legacy archive inventory identity is invalid.");
  const promotions: Promotion[] = [];
  for (const item of inventory.items) for (const media of item.mediaAssets) {
    const base = `media/items/${item.id}/${media.id}`;
    promotions.push({ archivePath: media.imagePath, relativePath: `${base}.webp` }, { archivePath: media.thumbnailPath, relativePath: `${base}-thumb.webp` });
    if (media.sourcePath) promotions.push({ archivePath: media.sourcePath, relativePath: `${base}-source.webp` });
    await validateImage(files[media.imagePath]!, { width: media.width, height: media.height });
    await validateImage(files[media.thumbnailPath]!);
    if (media.sourcePath) await validateImage(files[media.sourcePath]!);
  }
  for (const collection of inventory.collections) if (collection.uploadCover) {
    const base = `media/collections/${collection.id}/${collection.uploadCover.id}`;
    promotions.push({ archivePath: collection.uploadCover.path, relativePath: `${base}.webp` }, { archivePath: collection.uploadCover.thumbnailPath, relativePath: `${base}-thumb.webp` });
    await validateImage(files[collection.uploadCover.path]!, { width: collection.uploadCover.width, height: collection.uploadCover.height });
    await validateImage(files[collection.uploadCover.thumbnailPath]!);
  }
  return { inventory, files, promotions, preview: { name:inventory.workspace.name, items: inventory.items.length, collections: inventory.collections.length, photos: inventory.items.reduce((count, item) => count + item.mediaAssets.length, 0), exportedAt: manifest.exportedAt } satisfies ImportPreview };
}

export async function previewInventoryArchive(input: Uint8Array): Promise<ImportPreview> {
  return (await validatedArchive(input)).preview;
}

async function isOccupied(client: Executor, workspaceId: string) {
  const result = await client.execute({sql:"SELECT (SELECT COUNT(*) FROM items WHERE workspace_id=?) + (SELECT COUNT(*) FROM collections WHERE workspace_id=?) + (SELECT COUNT(*) FROM locations WHERE workspace_id=?) AS count",args:[workspaceId,workspaceId,workspaceId]});
  const sequence=await client.execute({sql:"SELECT next_inventory_number FROM workspaces WHERE id=?",args:[workspaceId]});
  return Number(result.rows[0]?.count ?? 0) > 0 || Number(sequence.rows[0]?.next_inventory_number ?? 1)>1;
}

function safeStage(root: string, entry: string) {
  const full = path.resolve(root, entry);
  if (!full.startsWith(`${root}${path.sep}`)) throw new ImportError("An import staging path is invalid.");
  return full;
}

const promotionSchema=z.object({archivePath:z.string(),relativePath:z.string().regex(/^media\/(?:items|collections)\/[0-9a-f-]{36}\/[0-9a-f-]{36}(?:-thumb|-source)?\.webp$/)});
const journalSchema=z.object({version:z.literal(2),operationId:id,targetInventoryId:id,promotions:z.array(promotionSchema).max(20_000)});

async function isReferenced(client:Executor,relative:string) {
  const rows=await client.execute({sql:"SELECT 1 FROM media_assets WHERE ('media/items/'||storage_path)=? OR ('media/items/'||thumbnail_path)=? OR ('media/items/'||source_storage_path)=? UNION ALL SELECT 1 FROM collection_cover_assets WHERE ('media/'||storage_path)=? OR ('media/'||thumbnail_path)=? LIMIT 1",args:[relative,relative,relative,relative,relative]});
  return rows.rows.length>0;
}

async function retainRecovery(directory:string,stage:string,status:string) {
  const recovery=path.join(directory,"recovery");
  const destination=path.join(recovery,path.basename(stage));
  await assertPrivatePath(directory,stage); await assertPrivatePath(directory,destination);
  await mkdir(recovery,{recursive:true});
  const stagedMedia=path.join(stage,"media"); await assertPrivatePath(directory,stagedMedia);
  await rm(stagedMedia,{recursive:true,force:true});
  await writeFile(path.join(stage,"recovery.json"),JSON.stringify({status,recoveredAt:new Date().toISOString()}));
  await rename(stage,destination);
}

async function recoverInterruptedImports(client:Client,directory:string) {
  for(const entry of await readdir(directory,{withFileTypes:true})) {
    if(!entry.isDirectory() || !/^\.import-[0-9a-f-]{36}$/.test(entry.name)) continue;
    const stage=safeStage(directory,entry.name); await assertPrivatePath(directory,stage);
    let raw:unknown;
    try { raw=JSON.parse(await readFile(path.join(stage,"journal.json"),"utf8")); }
    catch(error) {
      if(error instanceof Error && "code" in error && error.code==="ENOENT") { await retainRecovery(directory,stage,"staging-interrupted"); continue; }
      throw new ImportError("An interrupted import needs recovery before continuing.","failed");
    }
    const old=Array.isArray(raw);
    const legacy=old?z.array(promotionSchema.shape.relativePath).parse(raw):null;
    const journal=old?null:journalSchema.parse(raw);
    if(journal && entry.name!==`.import-${journal.operationId}`) throw new ImportError("Invalid import recovery journal.","failed");
    const committed=journal?(await client.execute({sql:"SELECT id FROM inventory_import_operations WHERE id=? AND workspace_id=?",args:[journal.operationId,journal.targetInventoryId]})).rows.length>0:false;
    const files=legacy??journal!.promotions.map(file=>file.relativePath);
    if(!committed) for(const relative of files) if(!await isReferenced(client,relative)) {
      const full=safeStage(directory,relative); await assertPrivatePath(directory,full); await rm(full,{force:true});
    }
    await retainRecovery(directory,stage,committed?"committed-inventory-preserved":"uncommitted-import-cleaned");
  }
}

export async function recoverInventoryImports(client:Client,directory:string) {
  return withInventoryOperation(directory,()=>recoverInterruptedImports(client,directory));
}

export async function restoreInventoryArchive(input:Uint8Array,context:{client:Client;directory:string;workspaceId:string},fault?:"stage"|"prepare"|"promote") {
  return withInventoryOperation(context.directory,()=>restoreEmptyInventoryArchive(input,context,fault));
}

async function insertRow(client: Executor, table: string, columns: string[], row: object) {
  const args = columns.map((column) => {
    const value = (row as Record<string, unknown>)[column];
    if (value === null || typeof value === "string" || typeof value === "number") return value as InValue;
    throw new ImportError("The archive contains an invalid database value.");
  });
  await client.execute({ sql: `INSERT INTO ${table} (${columns.join(",")}) VALUES (${columns.map(() => "?").join(",")})`, args });
}

async function restoreEmptyInventoryArchive(input: Uint8Array, context: { client: Client; directory: string; workspaceId: string }, fault?: "stage" | "prepare" | "promote") {
  const archive = await validatedArchive(input);
  const {directory,client,workspaceId}=context;
  id.parse(workspaceId);
  if (archive.inventory.workspace.id!==workspaceId) throw new ImportError("Archive belongs to a different inventory.");
  await mkdir(directory, { recursive: true });
  await recoverInterruptedImports(client, directory);
  if (await isOccupied(client,workspaceId)) throw new ImportError("Import requires an empty inventory.", "occupied");
  const stage = path.join(directory, `.import-${randomUUID()}`);
  await mkdir(stage);
  const promoted: string[] = [];
  let committed = false;
  try {
    for (const promotion of archive.promotions) {
      const destination = safeStage(stage, promotion.relativePath);
      await mkdir(path.dirname(destination), { recursive: true });
      await writeFile(destination, archive.files[promotion.archivePath]!, { flag: "wx" });
      const staged = await readFile(destination);
      const expected = archive.files[promotion.archivePath]!;
      if (createHash("sha256").update(staged).digest("hex") !== createHash("sha256").update(expected).digest("hex")) throw new ImportError("A staged photograph failed verification.", "failed");
      if (fault === "stage") throw new ImportError("Simulated staging failure.", "failed");
    }
    if (fault === "prepare") throw new ImportError("Simulated database preparation failure.", "failed");
    await writeFile(path.join(stage, "journal.json"), JSON.stringify(archive.promotions.map((promotion) => promotion.relativePath)), { flag: "wx" });
    // The write transaction hides rows until every staged file has reached its generated private path.
    const tx = await client.transaction("write");
    try {
      if (await isOccupied(tx,workspaceId)) throw new ImportError("Import requires an empty inventory.", "occupied");
      for (const promotion of archive.promotions) {
        const target = safeStage(directory, promotion.relativePath);
        await mkdir(path.dirname(target), { recursive: true });
        try { await lstat(target); throw new ImportError("A private media destination already exists.", "failed"); }
        catch (error) { if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error; }
        await assertPrivatePath(directory,target);
        const handle=await open(target,"wx"); promoted.push(target);
        try { await handle.writeFile(await readFile(safeStage(stage,promotion.relativePath))); await handle.sync(); } finally { await handle.close(); }
        if (fault === "promote") throw new ImportError("Simulated media promotion failure.", "failed");
      }
      await persistInventoryInTransaction(tx, archive.inventory);
      const integrity = await tx.execute("PRAGMA foreign_key_check");
      if (integrity.rows.length) throw new ImportError("Imported records failed relationship verification.", "failed");
      await tx.commit();
      committed = true;
    } catch (error) { await tx.rollback(); throw error; }
    return archive.preview;
  } finally {
    let clean = true;
    if (!committed) for (const target of promoted) try { await rm(target, { force: true }); } catch { clean = false; }
    if (clean) await rm(stage, { recursive: true, force: true });
  }
}

async function persistInventoryInTransaction(client: Executor, inventory: PortableInventory) {
  const workspaceId=inventory.workspace.id;
  const workspace = await client.execute({ sql: "SELECT id FROM workspaces WHERE id = ?", args: [workspaceId] });
  if (!workspace.rows.length) await insertRow(client, "workspaces", ["id", "name", "created_at", "next_inventory_number"], inventory.workspace);
  else await client.execute({ sql: "UPDATE workspaces SET name = ?, created_at = ?, next_inventory_number = ? WHERE id = ?", args: [inventory.workspace.name, inventory.workspace.created_at, inventory.workspace.next_inventory_number, workspaceId] });
  await client.execute({sql:"DELETE FROM inventory_preferences WHERE workspace_id=?",args:[workspaceId]});
  await client.execute({sql:"DELETE FROM custom_category_presentation WHERE workspace_id=?",args:[workspaceId]});
  if (inventory.preferences.sort !== "date") await client.execute({sql:"INSERT INTO inventory_preferences(workspace_id,version,sort) VALUES(?,1,?)",args:[workspaceId,inventory.preferences.sort]});
  for (const category of inventory.customCategories) await client.execute({sql:"INSERT INTO custom_category_presentation(workspace_id,category,emoji) VALUES(?,?,?)",args:[workspaceId,category.category,category.emoji]});
  for (const location of inventory.locations) await insertRow(client, "locations", ["id", "workspace_id", "name", "created_at"], location);
  for (const item of inventory.items) {
    await insertRow(client, "items", ["id", "workspace_id", "name", "model", "inventory_number", "brand", "category", "original_marking", "notes", "description", "identification_status", "tracking_mode", "sale_intent", "asking_price_minor", "asking_currency", "created_at", "updated_at"], item);
    for (const category of item.categories) await insertRow(client, "item_categories", ["item_id", "category"], { item_id: item.id, category });
    for (const stock of item.stock) await insertRow(client, "stock_entries", ["id", "item_id", "location_id", "quantity", "created_at", "updated_at"], stock);
    for (const media of item.mediaAssets) await insertRow(client, "media_assets", ["id", "item_id", "storage_path", "thumbnail_path", "source_storage_path", "crop_data", "original_filename", "mime_type", "width", "height", "created_at", "is_primary", "display_order"], {
      id: media.id, item_id: item.id, storage_path: `${item.id}/${media.id}.webp`, thumbnail_path: `${item.id}/${media.id}-thumb.webp`, source_storage_path: media.sourcePath ? `${item.id}/${media.id}-source.webp` : null,
      crop_data: media.cropData, original_filename: media.originalFilename, mime_type: media.mimeType, width: media.width, height: media.height, created_at: media.createdAt, is_primary: media.isPrimary ? 1 : 0, display_order: media.displayOrder,
    });
  }
  for (const collection of inventory.collections) {
    await insertRow(client, "collections", ["id", "workspace_id", "name", "normalized_name", "created_at", "updated_at", "icon", "cover_type", "cover_icon", "cover_item_id", "cover_media_id", "cover_upload_id"], {...collection,cover_type:"default",cover_item_id:null,cover_media_id:null,cover_upload_id:null});
    if (collection.uploadCover) await insertRow(client, "collection_cover_assets", ["id", "collection_id", "storage_path", "thumbnail_path", "width", "height", "created_at"], {
      id: collection.uploadCover.id, collection_id: collection.id, storage_path: `collections/${collection.id}/${collection.uploadCover.id}.webp`, thumbnail_path: `collections/${collection.id}/${collection.uploadCover.id}-thumb.webp`, width: collection.uploadCover.width, height: collection.uploadCover.height, created_at: collection.uploadCover.createdAt,
    });
  }
  for (const membership of inventory.memberships) await insertRow(client, "item_collection_memberships", ["id", "collection_id", "item_id", "created_at"], membership);
  for (const collection of inventory.collections) await client.execute({sql:"UPDATE collections SET cover_type=?,cover_item_id=?,cover_media_id=?,cover_upload_id=? WHERE id=? AND workspace_id=?",args:[collection.cover_type,collection.cover_item_id,collection.cover_media_id,collection.cover_upload_id,collection.id,workspaceId]});
}

function remapInventory(source:PortableInventory,name:string) {
  const inventory=structuredClone(source);
  const mapping:Record<string,Record<string,string>>={workspaces:{},items:{},locations:{},stock:{},collections:{},memberships:{},media:{},covers:{}};
  const allocated=new Set<string>();
  const allocate=(kind:string,old:string) => {
    const mapped=mapping[kind]!;
    if(mapped[old]) throw new ImportError("Duplicate identity in import plan.");
    const value=randomUUID(); if(allocated.has(value)) throw new ImportError("Invalid identity allocation.");
    allocated.add(value); mapped[old]=value; return value;
  };
  const reference=(kind:string,old:string)=>{const value=mapping[kind]![old];if(!value)throw new ImportError("Missing identity mapping.");return value;};
  const workspaceId=allocate("workspaces",inventory.workspace.id);
  inventory.workspace={...inventory.workspace,id:workspaceId,name:inventoryName.parse(name)};
  for(const location of inventory.locations) { location.id=allocate("locations",location.id);location.workspace_id=workspaceId; }
  for(const item of inventory.items) {
    item.id=allocate("items",item.id);item.workspace_id=workspaceId;
    for(const stock of item.stock) {stock.id=allocate("stock",stock.id);stock.item_id=item.id;stock.location_id=stock.location_id?reference("locations",stock.location_id):null;}
    for(const media of item.mediaAssets) media.id=allocate("media",media.id);
    item.primaryMediaId=item.primaryMediaId?reference("media",item.primaryMediaId):null;
  }
  for(const collection of inventory.collections) {
    collection.id=allocate("collections",collection.id);collection.workspace_id=workspaceId;
    if(collection.uploadCover) collection.uploadCover.id=allocate("covers",collection.uploadCover.id);
  }
  for(const item of inventory.items) item.collectionIds=item.collectionIds.map(value=>reference("collections",value));
  for(const collection of inventory.collections) {
    collection.itemIds=collection.itemIds.map(value=>reference("items",value));
    collection.cover_item_id=collection.cover_item_id?reference("items",collection.cover_item_id):null;
    collection.cover_media_id=collection.cover_media_id?reference("media",collection.cover_media_id):null;
    collection.cover_upload_id=collection.cover_upload_id?reference("covers",collection.cover_upload_id):null;
  }
  for(const membership of inventory.memberships) {
    membership.id=allocate("memberships",membership.id);
    membership.item_id=reference("items",membership.item_id);membership.collection_id=reference("collections",membership.collection_id);
  }
  return {inventory:validatedRecords(inventory),mapping};
}

function plannedPromotions(inventory:PortableInventory):Promotion[] {
  const promotions:Promotion[]=[];
  for(const item of inventory.items) for(const media of item.mediaAssets) {
    const base=`media/items/${item.id}/${media.id}`;
    promotions.push({archivePath:media.imagePath,relativePath:`${base}.webp`},{archivePath:media.thumbnailPath,relativePath:`${base}-thumb.webp`});
    if(media.sourcePath) promotions.push({archivePath:media.sourcePath,relativePath:`${base}-source.webp`});
  }
  for(const collection of inventory.collections) if(collection.uploadCover) {
    const base=`media/collections/${collection.id}/${collection.uploadCover.id}`;
    promotions.push({archivePath:collection.uploadCover.path,relativePath:`${base}.webp`},{archivePath:collection.uploadCover.thumbnailPath,relativePath:`${base}-thumb.webp`});
  }
  if(new Set(promotions.map(file=>file.relativePath)).size!==promotions.length) throw new ImportError("Duplicate generated media destination.");
  return promotions;
}

export type ImportFault="stage"|"prepare"|"promote"|"transaction"|"interrupt"|"after-commit";

export async function importArchiveAsNew(context:InventoryContext,input:Uint8Array,name:unknown,storage:{client:Client;directory:string},fault?:ImportFault) {
  const targetName=inventoryName.parse(name);
  const archive=await validatedArchive(input);
  const plan=remapInventory(archive.inventory,targetName);
  const promotions=plannedPromotions(plan.inventory);
  const {client,directory}=storage;
  id.parse(context.workspaceId);
  return withInventoryOperation(directory,async()=>{
    if(!(await client.execute({sql:"SELECT id FROM workspaces WHERE id=?",args:[context.workspaceId]})).rows.length) throw new ImportError("Inventory not found.","failed");
    await recoverInterruptedImports(client,directory);
    const operationId=randomUUID();
    const stage=safeStage(directory,`.import-${operationId}`);
    const targetInventoryId=plan.inventory.workspace.id;
    const tables:Record<string,string>={workspaces:"workspaces",items:"items",locations:"locations",stock:"stock_entries",collections:"collections",memberships:"item_collection_memberships",media:"media_assets",covers:"collection_cover_assets"};
    for(const [kind,map] of Object.entries(plan.mapping)) {
      const ids=Object.values(map);
      for(let offset=0;offset<ids.length;offset+=100) {
        const batch=ids.slice(offset,offset+100);
        if((await client.execute({sql:`SELECT id FROM ${tables[kind]} WHERE id IN (${batch.map(()=>"?").join(",")})`,args:batch})).rows.length) throw new ImportError("An allocated identity already exists.","failed");
      }
    }
    // Check every destination before recording a promotion plan. Existing files are never adopted.
    for(const file of promotions) {
      const destination=safeStage(directory,file.relativePath);await assertPrivatePath(directory,destination);
      try { await lstat(destination);throw new ImportError("A generated media destination exists.","failed"); }
      catch(error) {if(!(error instanceof Error && "code" in error && error.code==="ENOENT"))throw error;}
    }
    await mkdir(stage);
    const promoted:string[]=[];
    let committed=false,interrupted=false;
    try {
      await writeFile(path.join(stage,"source.zip"),input,{flag:"wx"});
      await writeFile(path.join(stage,"mapping.json"),JSON.stringify(plan.mapping),{flag:"wx"});
      const journal=await open(path.join(stage,"journal.json"),"wx");
      try {await journal.writeFile(JSON.stringify({version:2,operationId,targetInventoryId,promotions}));await journal.sync();} finally {await journal.close();}
      for(const file of promotions) {
        const destination=safeStage(stage,file.relativePath);await assertPrivatePath(directory,destination);
        await mkdir(path.dirname(destination),{recursive:true});
        await writeFile(destination,archive.files[file.archivePath]!,{flag:"wx"});
        const bytes=await readFile(destination);
        if(createHash("sha256").update(bytes).digest("hex")!==createHash("sha256").update(archive.files[file.archivePath]!).digest("hex"))throw new ImportError("Staged media verification failed.","failed");
        if(fault==="stage")throw new ImportError("Simulated staging failure.","failed");
      }
      if(fault==="prepare")throw new ImportError("Simulated preparation failure.","failed");
      const tx=await client.transaction("write");
      try {
        for(const file of promotions) {
          const target=safeStage(directory,file.relativePath);await assertPrivatePath(directory,target);await mkdir(path.dirname(target),{recursive:true});
          const handle=await open(target,"wx");promoted.push(target);
          try {await handle.writeFile(await readFile(safeStage(stage,file.relativePath)));await handle.sync();} finally {await handle.close();}
          if(fault==="promote")throw new ImportError("Simulated promotion failure.","failed");
          if(fault==="interrupt") {interrupted=true;throw new ImportError("Simulated interruption.","failed");}
        }
        await assertUniqueInventoryName(tx,targetName);
        await persistInventoryInTransaction(tx,plan.inventory);
        await tx.execute({sql:"INSERT INTO inventory_import_operations(id,workspace_id,created_at) VALUES(?,?,?)",args:[operationId,targetInventoryId,new Date().toISOString()]});
        if(fault==="transaction")throw new ImportError("Simulated transaction failure.","failed");
        if((await tx.execute("PRAGMA foreign_key_check")).rows.length)throw new ImportError("Imported relationships are invalid.","failed");
        await tx.commit();committed=true;
      }catch(error){await tx.rollback();throw error;}
      if(fault==="after-commit"){interrupted=true;throw new ImportError("Simulated interruption after commit.","failed");}
      return {...archive.preview,inventoryId:targetInventoryId,name:targetName};
    } finally {
      if(!interrupted) {
        if(!committed) for(const target of promoted) {await assertPrivatePath(directory,target);if(!await isReferenced(client,path.relative(directory,target).replaceAll(path.sep,"/")))await rm(target,{force:true});}
        if(committed) {try {await assertPrivatePath(directory,stage);await rm(stage,{recursive:true,force:true});}catch{console.error("Committed import staging cleanup deferred");}}
        else await retainRecovery(directory,stage,"failed-import-cleaned");
      }
    }
  });
}
