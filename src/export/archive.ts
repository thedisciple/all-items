import { createHash } from "node:crypto";
import { lstat, readFile } from "node:fs/promises";
import path from "node:path";
import { unzipSync, zipSync } from "fflate";
import { z } from "zod";
import { getDatabase, dataDirectory } from "@/db/client";

export const ARCHIVE_FORMAT = "all-items-portable-inventory";
export const ARCHIVE_VERSION = 1;
export const MAX_ARCHIVE_BYTES = 128 * 1024 * 1024;
export const MAX_ENTRY_BYTES = 32 * 1024 * 1024;
export const MAX_ARCHIVE_ENTRIES = 20_000;
export const MAX_ARCHIVE_PATH = 240;
const workspaceId = "00000000-0000-4000-8000-000000000001";

const digest = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const safePath = (value: string) => Buffer.byteLength(value, "utf8") > 0 && Buffer.byteLength(value, "utf8") <= MAX_ARCHIVE_PATH && !/[\u0000-\u001f\u007f]/.test(value) && !value.startsWith("/") && !value.includes("\\") && !value.split("/").some((part) => part === "" || part === "." || part === "..") && !/^[A-Za-z]:/.test(value);
const manifestSchema = z.object({
  format: z.literal(ARCHIVE_FORMAT), version: z.literal(ARCHIVE_VERSION), exportedAt: z.string().datetime(), applicationVersion: z.string(),
  entries: z.array(z.object({ path: z.string(), size: z.number().int().nonnegative(), sha256: z.string().regex(/^[0-9a-f]{64}$/) })).max(MAX_ARCHIVE_ENTRIES),
});
const portableInventorySchema = z.object({
  workspace: z.union([z.record(z.string(), z.unknown()), z.null()]),
  locations: z.array(z.record(z.string(), z.unknown())),
  items: z.array(z.object({ id: z.string().uuid(), stock: z.array(z.record(z.string(), z.unknown())), collectionIds: z.array(z.string().uuid()), mediaAssets: z.array(z.record(z.string(), z.unknown())) }).passthrough()),
  collections: z.array(z.object({ id: z.string().uuid(), itemIds: z.array(z.string().uuid()) }).passthrough()),
  memberships: z.array(z.object({ item_id: z.string().uuid(), collection_id: z.string().uuid() }).passthrough()),
}).passthrough();

export type ArchiveVerification = { valid: true; format: string; version: number; entryCount: number };
export class ArchiveError extends Error { constructor(message: string) { super(message); this.name = "ArchiveError"; } }

export function verifyInventoryArchive(input: Uint8Array): ArchiveVerification {
  if (!input.length || input.length > MAX_ARCHIVE_BYTES) throw new ArchiveError("Archive size is outside the supported limit.");
  preflightZip(input);
  let files: Record<string, Uint8Array>;
  try { files = unzipSync(input); } catch { throw new ArchiveError("The ZIP archive is damaged or invalid."); }
  const names = Object.keys(files);
  if (names.length < 3 || names.length > MAX_ARCHIVE_ENTRIES) throw new ArchiveError("The archive has an invalid number of entries.");
  for (const name of names) {
    if (!safePath(name)) throw new ArchiveError("The archive contains an unsafe path.");
    if (files[name]!.byteLength > MAX_ENTRY_BYTES) throw new ArchiveError("An archive entry exceeds the supported size.");
  }
  const manifestBytes = files["manifest.json"];
  const inventoryBytes = files["inventory.json"];
  const checksumBytes = files["checksums.sha256"];
  if (!manifestBytes || !inventoryBytes || !checksumBytes) throw new ArchiveError("The archive is missing a required entry.");
  let manifest: z.infer<typeof manifestSchema>;
  let inventory: Record<string, unknown>;
  try { manifest = manifestSchema.parse(JSON.parse(Buffer.from(manifestBytes).toString("utf8"))); inventory = portableInventorySchema.parse(JSON.parse(Buffer.from(inventoryBytes).toString("utf8"))); }
  catch { throw new ArchiveError("The archive metadata is invalid or uses an unsupported version."); }
  const expected = new Map<string, { size: number; sha256: string }>();
  for (const entry of manifest.entries) {
    if (!safePath(entry.path) || entry.path === "checksums.sha256" || expected.has(entry.path)) throw new ArchiveError("The manifest contains an invalid path.");
    expected.set(entry.path, entry);
  }
  if (expected.size !== names.length - 2) throw new ArchiveError("The archive entries do not match the manifest.");
  for (const [name, meta] of expected) {
    const bytes = files[name];
    if (!bytes || bytes.byteLength !== meta.size || digest(bytes) !== meta.sha256) throw new ArchiveError(`Archive integrity check failed for ${name}.`);
  }
  const checksumText = Buffer.from(checksumBytes).toString("utf8");
  const lines = checksumText.trimEnd().split("\n");
  if (lines.length !== expected.size) throw new ArchiveError("The checksum list is incomplete.");
  const checksumPaths = new Set<string>();
  for (const line of lines) {
    const match = /^([0-9a-f]{64})  (.+)$/.exec(line);
    if (!match || !safePath(match[2]!) || checksumPaths.has(match[2]!) || expected.get(match[2]!)?.sha256 !== match[1]) throw new ArchiveError("The checksum list is invalid.");
    checksumPaths.add(match[2]!);
  }
  validateReferences(inventory, files);
  return { valid: true, format: manifest.format, version: manifest.version, entryCount: names.length };
}

function preflightZip(input: Uint8Array) {
  const view = new DataView(input.buffer, input.byteOffset, input.byteLength);
  let eocd = -1;
  const lower = Math.max(0, input.byteLength - 65_557);
  for (let offset = input.byteLength - 22; offset >= lower; offset--) if (view.getUint32(offset, true) === 0x06054b50) { eocd = offset; break; }
  if (eocd < 0) throw new ArchiveError("The ZIP archive has no valid directory.");
  const entries = view.getUint16(eocd + 10, true);
  const centralSize = view.getUint32(eocd + 12, true);
  let offset = view.getUint32(eocd + 16, true);
  if (entries > MAX_ARCHIVE_ENTRIES || offset + centralSize > eocd) throw new ArchiveError("The ZIP directory exceeds supported limits.");
  let expanded = 0;
  for (let index = 0; index < entries; index++) {
    if (offset + 46 > input.byteLength || view.getUint32(offset, true) !== 0x02014b50) throw new ArchiveError("The ZIP directory is invalid.");
    const flags = view.getUint16(offset + 8, true);
    const method = view.getUint16(offset + 10, true);
    const compressed = view.getUint32(offset + 20, true);
    const uncompressed = view.getUint32(offset + 24, true);
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    if ((flags & 1) !== 0 || (method !== 0 && method !== 8) || uncompressed > MAX_ENTRY_BYTES || compressed === 0 && uncompressed > 0 || compressed > 0 && uncompressed / compressed > 100) throw new ArchiveError("The ZIP contains an unsupported or oversized entry.");
    expanded += uncompressed;
    if (expanded > MAX_ARCHIVE_BYTES) throw new ArchiveError("The ZIP expands beyond the supported limit.");
    offset += 46 + nameLength + extraLength + commentLength;
  }
  if (offset !== view.getUint32(eocd + 16, true) + centralSize) throw new ArchiveError("The ZIP directory size is invalid.");
}

function validateReferences(inventory: Record<string, unknown>, files: Record<string, Uint8Array>) {
  const assetPaths = new Set<string>();
  const values = Array.isArray(inventory.items) ? inventory.items : [];
  const itemsById = new Map<string, Set<string>>();
  for (const item of values as Array<Record<string, unknown>>) {
    if (typeof item.id !== "string" || !z.string().uuid().safeParse(item.id).success || !Array.isArray(item.mediaAssets)) throw new ArchiveError("An item has invalid media references.");
    const mediaIds = new Set<string>();
    let primaryCount = 0;
    for (const asset of item.mediaAssets as Array<Record<string, unknown>>) for (const key of ["imagePath", "thumbnailPath", "sourcePath"]) {
      const value = asset[key];
      if (value === null && key === "sourcePath") continue;
      if (typeof value !== "string" || !safePath(value) || !files[value]) throw new ArchiveError("An item references a missing or unsafe media asset.");
      assetPaths.add(value);
    }
    for (const asset of item.mediaAssets as Array<Record<string, unknown>>) {
      if (typeof asset.id !== "string" || !z.string().uuid().safeParse(asset.id).success || mediaIds.has(asset.id) || typeof asset.isPrimary !== "boolean") throw new ArchiveError("An item has invalid media identity metadata.");
      if (asset.imagePath !== `media/items/${item.id}/${asset.id}.webp` || asset.thumbnailPath !== `media/items/${item.id}/${asset.id}-thumb.webp` || (asset.sourcePath !== null && asset.sourcePath !== `media/items/${item.id}/${asset.id}-source.webp`)) throw new ArchiveError("An item media path does not match its identifiers.");
      mediaIds.add(asset.id);
      if (asset.isPrimary) primaryCount++;
    }
    if (mediaIds.size > 0 && primaryCount !== 1) throw new ArchiveError("An item must have exactly one primary media asset when it has photos.");
    if (typeof item.id === "string") itemsById.set(item.id, mediaIds);
  }
  const collections = Array.isArray(inventory.collections) ? inventory.collections : [];
  const collectionsById = new Map<string, Record<string, unknown>>();
  for (const collection of collections as Array<Record<string, unknown>>) {
    if (typeof collection.id !== "string" || !z.string().uuid().safeParse(collection.id).success || collectionsById.has(collection.id)) throw new ArchiveError("A collection has invalid identity metadata.");
    collectionsById.set(collection.id, collection);
    if (!Array.isArray(collection.itemIds)) throw new ArchiveError("A collection has invalid membership data.");
    const itemIds = collection.itemIds;
    if (itemIds.some((id) => typeof id !== "string" || !itemsById.has(id))) throw new ArchiveError("A collection references a missing item.");
    const uploadCover = collection.uploadCover;
    const coverPath = typeof uploadCover === "object" && uploadCover !== null ? (uploadCover as Record<string, unknown>).path : null;
    const thumbnailPath = typeof uploadCover === "object" && uploadCover !== null ? (uploadCover as Record<string, unknown>).thumbnailPath : null;
    if (collection.cover_type === "upload") {
      const cover = typeof uploadCover === "object" && uploadCover !== null ? uploadCover as Record<string, unknown> : {};
      if (typeof cover.id !== "string" || !z.string().uuid().safeParse(cover.id).success || cover.id !== collection.cover_upload_id || coverPath !== `media/collections/${collection.id}/${cover.id}.webp` || thumbnailPath !== `media/collections/${collection.id}/${cover.id}-thumb.webp` || !files[coverPath] || !files[thumbnailPath]) throw new ArchiveError("A collection references a missing or unsafe cover.");
      assetPaths.add(coverPath); assetPaths.add(thumbnailPath);
    } else if (uploadCover !== null) throw new ArchiveError("A collection has unselected cover files.");
    if (collection.cover_type === "item_photo") {
      const itemId = collection.cover_item_id;
      const mediaId = collection.cover_media_id;
      if (typeof itemId !== "string" || typeof mediaId !== "string" || !itemIds.includes(itemId) || !itemsById.get(itemId)?.has(mediaId)) throw new ArchiveError("A collection photo cover references a missing member photo.");
    }
  }
  const memberships = Array.isArray(inventory.memberships) ? inventory.memberships : [];
  const membershipPairs = new Set<string>();
  for (const membership of memberships as Array<Record<string, unknown>>) {
    if (typeof membership.item_id !== "string" || typeof membership.collection_id !== "string" || !itemsById.has(membership.item_id) || !collectionsById.has(membership.collection_id)) throw new ArchiveError("A collection membership references a missing record.");
    const pair = `${membership.collection_id}\u0000${membership.item_id}`;
    if (membershipPairs.has(pair)) throw new ArchiveError("A collection membership is duplicated.");
    membershipPairs.add(pair);
    const item = (values as Array<Record<string, unknown>>).find((candidate) => candidate.id === membership.item_id);
    const collection = collectionsById.get(membership.collection_id)!;
    if (!Array.isArray(item?.collectionIds) || !item.collectionIds.includes(membership.collection_id) || !Array.isArray(collection.itemIds) || !collection.itemIds.includes(membership.item_id)) throw new ArchiveError("Collection membership lists are inconsistent.");
  }
  const listedPairs = new Set<string>();
  for (const collection of collectionsById.values()) for (const itemId of collection.itemIds as string[]) listedPairs.add(`${collection.id}\u0000${itemId}`);
  if (listedPairs.size !== membershipPairs.size || [...listedPairs].some((pair) => !membershipPairs.has(pair))) throw new ArchiveError("Collection membership lists are incomplete.");
  for (const item of values as Array<Record<string, unknown>>) if (!Array.isArray(item.collectionIds) || item.collectionIds.some((id) => typeof id !== "string" || !collectionsById.get(id)?.itemIds || !(collectionsById.get(id)!.itemIds as unknown[]).includes(item.id))) throw new ArchiveError("An item's collection list is inconsistent.");
  const packagedAssets = Object.keys(files).filter((name) => name.startsWith("media/"));
  if ([...assetPaths].some((asset) => !asset.startsWith("media/")) || packagedAssets.length !== assetPaths.size || packagedAssets.some((asset) => !assetPaths.has(asset))) throw new ArchiveError("The archive contains missing or unreferenced media files.");
}

export function buildInventoryArchive(inventory: Record<string, unknown>, assets: Record<string, Uint8Array> = {}) {
  const entries: Record<string, Uint8Array> = {};
  let totalSize = 0;
  for (const [name, bytes] of Object.entries(assets)) {
    if (!safePath(name) || !name.startsWith("media/") || bytes.byteLength > MAX_ENTRY_BYTES) throw new ArchiveError("An archive asset has an invalid path or size.");
    totalSize += bytes.byteLength;
    if (Object.keys(entries).length + 3 > MAX_ARCHIVE_ENTRIES || totalSize > MAX_ARCHIVE_BYTES) throw new ArchiveError("The inventory exceeds the supported archive limits.");
    entries[name] = bytes;
  }
  entries["inventory.json"] = Buffer.from(JSON.stringify(inventory, null, 2), "utf8");
  if (entries["inventory.json"]!.byteLength > MAX_ENTRY_BYTES || totalSize + entries["inventory.json"]!.byteLength > MAX_ARCHIVE_BYTES) throw new ArchiveError("Inventory metadata exceeds the supported archive limits.");
  const exportedAt = new Date().toISOString();
  const archiveManifest = { format: ARCHIVE_FORMAT, version: ARCHIVE_VERSION, exportedAt, applicationVersion: "0.1.0", entries: Object.entries(entries).map(([entryPath, data]) => ({ path: entryPath, size: data.length, sha256: digest(data) })) };
  entries["manifest.json"] = Buffer.from(JSON.stringify(archiveManifest, null, 2), "utf8");
  entries["checksums.sha256"] = Buffer.from(archiveManifest.entries.map((entry) => `${entry.sha256}  ${entry.path}`).join("\n") + "\n", "utf8");
  if (Object.values(entries).reduce((size, entry) => size + entry.byteLength, 0) > MAX_ARCHIVE_BYTES) throw new ArchiveError("The expanded inventory archive exceeds the 128 MiB limit.");
  const archive = zipSync(entries, { level: 0 });
  if (archive.byteLength > MAX_ARCHIVE_BYTES) throw new ArchiveError("The inventory archive exceeds the 128 MiB download limit.");
  return archive;
}

async function readSafeAsset(root: string, relative: string): Promise<Uint8Array> {
  if (!safePath(relative)) throw new ArchiveError("Stored media metadata contains an unsafe path.");
  const full = path.resolve(root, relative);
  const rel = path.relative(root, full);
  if (rel.startsWith(`..${path.sep}`) || rel === ".." || path.isAbsolute(rel)) throw new ArchiveError("Stored media metadata escapes its data directory.");
  const rootStat = await lstat(root);
  if (rootStat.isSymbolicLink() || !rootStat.isDirectory()) throw new ArchiveError("The private media directory is not a regular directory.");
  let current = root;
  for (const part of rel.split(path.sep)) {
    current = path.join(current, part);
    const stat = await lstat(current);
    if (stat.isSymbolicLink()) throw new ArchiveError("A private media path contains a symbolic link.");
  }
  const stat = await lstat(full);
  if (!stat.isFile() || stat.size > MAX_ENTRY_BYTES) throw new ArchiveError("A private media file is invalid or too large.");
  const bytes = await readFile(full);
  if (bytes.byteLength > MAX_ENTRY_BYTES) throw new ArchiveError("A private media file changed size while it was being read.");
  return new Uint8Array(bytes);
}

export async function createInventoryArchive() {
  const db = await getDatabase();
  const tx = await db.$client.transaction("read");
  let snapshot: Record<string, Array<Record<string, unknown>>>;
  try {
    const workspace = await tx.execute({ sql: "SELECT id, name, created_at, next_inventory_number FROM workspaces WHERE id = ?", args: [workspaceId] });
    const items = await tx.execute({ sql: "SELECT * FROM items WHERE workspace_id = ? ORDER BY inventory_number", args: [workspaceId] });
    const locations = await tx.execute({ sql: "SELECT * FROM locations WHERE workspace_id = ? ORDER BY name", args: [workspaceId] });
    const stock = await tx.execute("SELECT * FROM stock_entries ORDER BY item_id, created_at, id");
    const media = await tx.execute("SELECT * FROM media_assets ORDER BY item_id, created_at, id");
    const collections = await tx.execute({ sql: "SELECT * FROM collections WHERE workspace_id = ? ORDER BY created_at, id", args: [workspaceId] });
    const memberships = await tx.execute("SELECT * FROM item_collection_memberships ORDER BY collection_id, item_id");
    const covers = await tx.execute({ sql: `SELECT ca.* FROM collection_cover_assets ca JOIN collections c ON c.id = ca.collection_id
      WHERE c.workspace_id = ? AND c.cover_type = 'upload' AND c.cover_upload_id = ca.id ORDER BY ca.collection_id, ca.id`, args: [workspaceId] });
    snapshot = { workspaces: workspace.rows as unknown as Array<Record<string, unknown>>, items: items.rows as unknown as Array<Record<string, unknown>>, locations: locations.rows as unknown as Array<Record<string, unknown>>, stock: stock.rows as unknown as Array<Record<string, unknown>>, media: media.rows as unknown as Array<Record<string, unknown>>, collections: collections.rows as unknown as Array<Record<string, unknown>>, memberships: memberships.rows as unknown as Array<Record<string, unknown>>, covers: covers.rows as unknown as Array<Record<string, unknown>> };
    await tx.commit();
  } catch (error) { await tx.rollback(); throw error; }
  const total = snapshot.media.reduce((count, row) => count + (row.source_storage_path ? 3 : 2), 0) + snapshot.covers.length * 2 + 3;
  if (total > MAX_ARCHIVE_ENTRIES) throw new ArchiveError("This inventory contains too many archive entries.");
  const mediaRoot = path.join(dataDirectory(), "media");
  const payload: Record<string, unknown> = {
    workspace: snapshot.workspaces[0] ?? null,
    locations: snapshot.locations,
    items: snapshot.items.map((item) => ({ ...item, stock: snapshot.stock.filter((row) => row.item_id === item.id), collectionIds: snapshot.memberships.filter((row) => row.item_id === item.id).map((row) => row.collection_id), mediaAssets: snapshot.media.filter((row) => row.item_id === item.id).map((asset) => ({ id: asset.id, isPrimary: Boolean(asset.is_primary), displayOrder: null, originalFilename: asset.original_filename, mimeType: asset.mime_type, width: asset.width, height: asset.height, cropData: asset.crop_data, createdAt: asset.created_at, imagePath: `media/items/${asset.storage_path}`, thumbnailPath: `media/items/${asset.thumbnail_path}`, sourcePath: asset.source_storage_path ? `media/items/${asset.source_storage_path}` : null })) })),
    collections: snapshot.collections.map((collection) => { const cover = snapshot.covers.find((asset) => asset.collection_id === collection.id); return { ...collection, itemIds: snapshot.memberships.filter((row) => row.collection_id === collection.id).map((row) => row.item_id), uploadCover: cover ? { id: cover.id, width: cover.width, height: cover.height, createdAt: cover.created_at, path: `media/${collectionCoverPath(String(cover.storage_path))}`, thumbnailPath: `media/${collectionCoverPath(String(cover.thumbnail_path))}` } : null }; }),
    memberships: snapshot.memberships,
  };
  const assets: Record<string, Uint8Array> = {};
  const mediaAssets = snapshot.media.flatMap((asset) => [asset.storage_path, asset.thumbnail_path, ...(asset.source_storage_path ? [asset.source_storage_path] : [])].map((value) => `items/${String(value)}`));
  const collectionAssets = snapshot.covers.flatMap((asset) => [asset.storage_path, asset.thumbnail_path].map((value) => collectionCoverPath(String(value))));
  for (const relative of [...mediaAssets, ...collectionAssets]) assets[`media/${relative}`] = await readSafeAsset(mediaRoot, relative);
  return buildInventoryArchive(payload, assets);
}

function collectionCoverPath(storagePath: string) {
  const relative = storagePath;
  if (relative.includes("\\") || relative.split("/").some((part) => !part || part === "." || part === "..") || !/^collections\/[0-9a-f-]{36}\/[0-9a-f-]{36}(?:-thumb)?\.webp$/i.test(relative)) throw new ArchiveError("Collection cover metadata contains an unsafe path.");
  return relative;
}

export function csvCell(value: unknown) {
  let text = value == null ? "" : String(value);
  if (/^[\s\u0000-\u001f]*[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

export function formatInventoryCsv(rows: Array<Record<string, unknown>>) {
  const columns = ["Inventory number", "Name", "Model", "Brand", "Category", "Quantity", "Locations", "Identification status", "Sale intent", "Asking price", "Currency", "Description", "Notes"];
  return Buffer.from(`\uFEFF${[columns, ...rows.map((row) => [row.inventory_number, row.name, row.model, row.brand, row.category, row.quantity, row.locations, row.identification_status, row.sale_intent, row.asking_price_minor == null ? null : (Number(row.asking_price_minor) / 100).toFixed(2), row.asking_currency, row.description, row.notes])].map((row) => row.map(csvCell).join(",")).join("\r\n")}\r\n`, "utf8");
}

export async function createInventoryCsv() {
  const db = await getDatabase();
  const rows = await db.$client.execute({ sql: `SELECT i.inventory_number, i.name, i.model, i.brand, i.category, i.identification_status, i.sale_intent, i.asking_price_minor, i.asking_currency, i.description, i.notes, COALESCE(SUM(s.quantity), 0) AS quantity, GROUP_CONCAT(l.name, '; ') AS locations FROM items i LEFT JOIN stock_entries s ON s.item_id = i.id LEFT JOIN locations l ON l.id = s.location_id WHERE i.workspace_id = ? GROUP BY i.id ORDER BY i.inventory_number`, args: [workspaceId] });
  return formatInventoryCsv(rows.rows as unknown as Array<Record<string, unknown>>);
}
