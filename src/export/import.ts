import { type Client, type InValue } from "@libsql/client";
import { createHash, randomUUID } from "node:crypto";
import { lstat, mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp, { type Metadata } from "sharp";
import { z } from "zod";
import { dataDirectory, getDatabase } from "@/db/client";
import { cropDataSchema } from "@/media/crop-data";
import { readInventoryArchive } from "./archive";

const workspaceId = "00000000-0000-4000-8000-000000000001";
const id = z.string().uuid();
const nullableText = z.string().nullable();
const timestamp = z.string().min(1).max(100);
const locationSchema = z.object({ id, workspace_id: z.literal(workspaceId), name: z.string().min(1).max(120), created_at: timestamp });
const stockSchema = z.object({ id, item_id: id, location_id: id.nullable(), quantity: z.number().int().min(0).max(1_000_000), created_at: timestamp, updated_at: timestamp });
const mediaSchema = z.object({ id, isPrimary: z.boolean(), displayOrder: z.number().int().nonnegative().nullable(), originalFilename: z.string().max(255), mimeType: z.literal("image/webp"), width: z.number().int().positive().max(12_000), height: z.number().int().positive().max(12_000), cropData: nullableText, createdAt: timestamp, imagePath: z.string(), thumbnailPath: z.string(), sourcePath: z.string().nullable() });
const itemSchema = z.object({
  id, workspace_id: z.literal(workspaceId), inventory_number: z.string().regex(/^INV-\d{6,}$/), name: z.string().min(1).max(160), model: nullableText, brand: nullableText,
  category: nullableText, original_marking: nullableText, notes: nullableText, description: nullableText,
  identification_status: z.enum(["unknown", "user_confirmed", "source_verified"]), tracking_mode: z.enum(["unique", "bulk", "consumable"]),
  sale_intent: z.enum(["not_for_sale", "considering", "willing_to_sell"]), asking_price_minor: z.number().int().nonnegative().nullable(), asking_currency: nullableText,
  created_at: timestamp, updated_at: timestamp, stock: z.array(stockSchema).min(1).max(50), collectionIds: z.array(id), mediaAssets: z.array(mediaSchema),
});
const coverSchema = z.object({ id, width: z.number().int().positive().max(12_000), height: z.number().int().positive().max(12_000), createdAt: timestamp, path: z.string(), thumbnailPath: z.string() });
const collectionSchema = z.object({
  id, workspace_id: z.literal(workspaceId), name: z.string().trim().min(1).max(120), normalized_name: z.string().min(1), created_at: timestamp, updated_at: timestamp,
  icon: nullableText, cover_type: z.enum(["item_photo", "upload", "emoji", "default"]).nullable(), cover_icon: nullableText,
  cover_item_id: id.nullable(), cover_media_id: id.nullable(), cover_upload_id: id.nullable(), itemIds: z.array(id), uploadCover: coverSchema.nullable(),
});
const membershipSchema = z.object({ id, item_id: id, collection_id: id, created_at: timestamp });
const inventorySchema = z.object({ workspace: z.object({ id: z.literal(workspaceId), name: z.string(), created_at: timestamp, next_inventory_number: z.number().int().positive() }), locations: z.array(locationSchema), items: z.array(itemSchema), collections: z.array(collectionSchema), memberships: z.array(membershipSchema) });
type Inventory = z.infer<typeof inventorySchema>;
type Promotion = { archivePath: string; relativePath: string };
type Executor = Pick<Client, "execute">;
export type ImportPreview = { items: number; collections: number; photos: number; exportedAt: string };

export class ImportError extends Error { constructor(message: string, public code: "invalid" | "occupied" | "failed" = "invalid") { super(message); this.name = "ImportError"; } }

function validatedRecords(value: unknown): Inventory {
  const result = inventorySchema.safeParse(value);
  if (!result.success) throw new ImportError("The archive contains invalid inventory records.");
  const inventory = result.data;
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
    largestNumber = Math.max(largestNumber, Number(item.inventory_number.slice(4)));
    const stockLocations = new Set<string>();
    let total = 0;
    for (const stock of item.stock) {
      if (stockIds.has(stock.id) || stock.item_id !== item.id || stock.location_id && !locationIds.has(stock.location_id) || stockLocations.has(stock.location_id ?? "")) throw new ImportError("The archive contains invalid stock locations.");
      stockIds.add(stock.id); stockLocations.add(stock.location_id ?? ""); total += stock.quantity;
    }
    if (item.tracking_mode === "unique" && total !== 1) throw new ImportError("A unique item must have quantity one.");
    let primaryCount = 0;
    for (const media of item.mediaAssets) {
      if (mediaIds.has(media.id)) throw new ImportError("The archive contains duplicate photographs.");
      mediaIds.add(media.id);
      if (media.isPrimary) primaryCount++;
      if (media.cropData !== null) {
        try { cropDataSchema.parse(JSON.parse(media.cropData)); }
        catch { throw new ImportError("The archive contains invalid crop data."); }
      }
    }
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
  const inventory = validatedRecords(untyped);
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
  return { inventory, files, promotions, preview: { items: inventory.items.length, collections: inventory.collections.length, photos: inventory.items.reduce((count, item) => count + item.mediaAssets.length, 0), exportedAt: manifest.exportedAt } satisfies ImportPreview };
}

export async function previewInventoryArchive(input: Uint8Array): Promise<ImportPreview> {
  return (await validatedArchive(input)).preview;
}

async function isOccupied(client: Executor) {
  const result = await client.execute("SELECT (SELECT COUNT(*) FROM items) + (SELECT COUNT(*) FROM collections) + (SELECT COUNT(*) FROM locations) + (SELECT COUNT(*) FROM media_assets) + (SELECT COUNT(*) FROM collection_cover_assets) AS count");
  return Number(result.rows[0]?.count ?? 0) > 0;
}

function safeStage(root: string, entry: string) {
  const full = path.resolve(root, entry);
  if (!full.startsWith(`${root}${path.sep}`)) throw new ImportError("An import staging path is invalid.");
  return full;
}

async function recoverInterruptedImports(client: Client, directory: string) {
  const entries = await readdir(directory, { withFileTypes: true });
  const occupied = await isOccupied(client);
  for (const entry of entries) {
    if (!entry.isDirectory() || !/^\.import-[0-9a-f-]{36}$/.test(entry.name)) continue;
    const stage = safeStage(directory, entry.name);
    try {
      const journal = z.array(z.string().regex(/^media\/(?:items|collections)\/[0-9a-f-]{36}\/[0-9a-f-]{36}(?:-thumb|-source)?\.webp$/)).parse(JSON.parse(await readFile(path.join(stage, "journal.json"), "utf8")));
      if (!occupied) for (const relative of journal) await rm(safeStage(directory, relative), { force: true });
    } catch (error) {
      if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw new ImportError("An interrupted import needs recovery before continuing.", "failed");
    }
    await rm(stage, { recursive: true, force: true });
  }
}

async function insertRow(client: Executor, table: string, columns: string[], row: object) {
  const args = columns.map((column) => {
    const value = (row as Record<string, unknown>)[column];
    if (value === null || typeof value === "string" || typeof value === "number") return value as InValue;
    throw new ImportError("The archive contains an invalid database value.");
  });
  await client.execute({ sql: `INSERT INTO ${table} (${columns.join(",")}) VALUES (${columns.map(() => "?").join(",")})`, args });
}

export async function restoreInventoryArchive(input: Uint8Array, context?: { client: Client; directory: string }, fault?: "stage" | "prepare" | "promote") {
  const archive = await validatedArchive(input);
  const directory = context?.directory ?? dataDirectory();
  const client = context?.client ?? (await getDatabase()).$client;
  await mkdir(directory, { recursive: true });
  await recoverInterruptedImports(client, directory);
  if (await isOccupied(client)) throw new ImportError("Import requires an empty inventory.", "occupied");
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
      if (await isOccupied(tx)) throw new ImportError("Import requires an empty inventory.", "occupied");
      for (const promotion of archive.promotions) {
        const target = safeStage(directory, promotion.relativePath);
        await mkdir(path.dirname(target), { recursive: true });
        try { await lstat(target); throw new ImportError("A private media destination already exists.", "failed"); }
        catch (error) { if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error; }
        await rename(safeStage(stage, promotion.relativePath), target);
        promoted.push(target);
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

async function persistInventoryInTransaction(client: Executor, inventory: Inventory) {
  const workspace = await client.execute({ sql: "SELECT id FROM workspaces WHERE id = ?", args: [workspaceId] });
  if (!workspace.rows.length) await insertRow(client, "workspaces", ["id", "name", "created_at", "next_inventory_number"], inventory.workspace);
  else await client.execute({ sql: "UPDATE workspaces SET name = ?, created_at = ?, next_inventory_number = ? WHERE id = ?", args: [inventory.workspace.name, inventory.workspace.created_at, inventory.workspace.next_inventory_number, workspaceId] });
  for (const location of inventory.locations) await insertRow(client, "locations", ["id", "workspace_id", "name", "created_at"], location);
  for (const item of inventory.items) {
    await insertRow(client, "items", ["id", "workspace_id", "name", "model", "inventory_number", "brand", "category", "original_marking", "notes", "description", "identification_status", "tracking_mode", "sale_intent", "asking_price_minor", "asking_currency", "created_at", "updated_at"], item);
    for (const stock of item.stock) await insertRow(client, "stock_entries", ["id", "item_id", "location_id", "quantity", "created_at", "updated_at"], stock);
    for (const media of item.mediaAssets) await insertRow(client, "media_assets", ["id", "item_id", "storage_path", "thumbnail_path", "source_storage_path", "crop_data", "original_filename", "mime_type", "width", "height", "created_at", "is_primary"], {
      id: media.id, item_id: item.id, storage_path: `${item.id}/${media.id}.webp`, thumbnail_path: `${item.id}/${media.id}-thumb.webp`, source_storage_path: media.sourcePath ? `${item.id}/${media.id}-source.webp` : null,
      crop_data: media.cropData, original_filename: media.originalFilename, mime_type: media.mimeType, width: media.width, height: media.height, created_at: media.createdAt, is_primary: media.isPrimary ? 1 : 0,
    });
  }
  for (const collection of inventory.collections) {
    await insertRow(client, "collections", ["id", "workspace_id", "name", "normalized_name", "created_at", "updated_at", "icon", "cover_type", "cover_icon", "cover_item_id", "cover_media_id", "cover_upload_id"], collection);
    if (collection.uploadCover) await insertRow(client, "collection_cover_assets", ["id", "collection_id", "storage_path", "thumbnail_path", "width", "height", "created_at"], {
      id: collection.uploadCover.id, collection_id: collection.id, storage_path: `collections/${collection.id}/${collection.uploadCover.id}.webp`, thumbnail_path: `collections/${collection.id}/${collection.uploadCover.id}-thumb.webp`, width: collection.uploadCover.width, height: collection.uploadCover.height, created_at: collection.uploadCover.createdAt,
    });
  }
  for (const membership of inventory.memberships) await insertRow(client, "item_collection_memberships", ["id", "collection_id", "item_id", "created_at"], membership);
}
