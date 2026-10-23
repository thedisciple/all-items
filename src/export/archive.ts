import { createHash } from "node:crypto";
import { lstat, readFile } from "node:fs/promises";
import path from "node:path";
import { unzipSync, zipSync } from "fflate";
import { z } from "zod";
import type { Client } from "@libsql/client";
import { canonicalCategories, canonicalCategory } from "@/items/categories";
import { getDatabase, dataDirectory } from "@/db/client";

export const ARCHIVE_FORMAT = "all-items-portable-inventory";
export const ARCHIVE_VERSION = 3;
export const MAX_ARCHIVE_BYTES = 128 * 1024 * 1024;
export const MAX_ENTRY_BYTES = 32 * 1024 * 1024;
export const MAX_ARCHIVE_ENTRIES = 20_000;
export const MAX_ARCHIVE_PATH = 240;
const workspaceId = "00000000-0000-4000-8000-000000000001";

const digest = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const windowsDevice = /^(?:CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)/i;
const safePath = (value: string) => Buffer.byteLength(value, "utf8") > 0 && Buffer.byteLength(value, "utf8") <= MAX_ARCHIVE_PATH && value === value.normalize("NFC") && !value.startsWith("/") && value.split("/").every((part) => part.length > 0 && part !== "." && part !== ".." && !/[\\:*?"<>|\u0000-\u001f\u007f]/u.test(part) && !/[. ]$/.test(part) && !windowsDevice.test(part));
const pathKey = (value: string) => value.normalize("NFKC").toLocaleLowerCase("en-US");

function readableStem(value: unknown, fallback: string, maxBytes = 70) {
  let stem = (typeof value === "string" ? value : "").normalize("NFC").replace(/[\\/:*?"<>|\u0000-\u001f\u007f]/gu, " ").replace(/\s+/gu, " ").trim().replace(/[. ]+$/gu, "");
  if (!stem || windowsDevice.test(stem)) stem = fallback;
  const points = [...stem];
  while (Buffer.byteLength(stem, "utf8") > maxBytes) { points.pop(); stem = points.join(""); }
  return stem.replace(/[. ]+$/gu, "") || fallback;
}

export function itemArchivePaths(item: Record<string, unknown>, _asset: Record<string, unknown>, index = 0, count = 1) {
  const number = readableStem(item.inventory_number, "item", 32);
  const name = readableStem(item.name, "Item", 64);
  const folder = `Items/${number} - ${name}`;
  if (count === 1) return { imagePath: `${folder}/main.webp`, thumbnailPath: `${folder}/thumbnail.webp`, sourcePath: `${folder}/editable.webp` };
  const base = `${folder}/photo-${String(index+1).padStart(2,"0")}`;
  return { imagePath: `${base}.webp`, thumbnailPath: `${base}-thumbnail.webp`, sourcePath: `${base}-editable.webp` };
}

export function collectionArchivePaths(collection: Record<string, unknown>) {
  const name = readableStem(collection.name, "Collection", 70);
  const suffix = typeof collection.id === "string" ? collection.id.slice(0, 8) : "cover";
  const folder = `Collections/${name} - ${suffix}`;
  return { path: `${folder}/cover.webp`, thumbnailPath: `${folder}/thumbnail.webp` };
}

function canonicalizeInventory(inventory: Record<string, unknown>, assets: Record<string, Uint8Array>) {
  const copy = structuredClone(inventory);
  const mapped: Record<string, Uint8Array> = {};
  const move = (record: Record<string, unknown>, key: string, newPath: string) => {
    const oldPath = record[key];
    if (typeof oldPath !== "string") return;
    record[key] = newPath;
    if (assets[oldPath]) mapped[newPath] = assets[oldPath];
  };
  for (const item of (Array.isArray(copy.items) ? copy.items : []) as Array<Record<string, unknown>>) {
    item.categories ??= canonicalCategories(typeof item.category === "string" ? [item.category] : []);
    const photos = (Array.isArray(item.mediaAssets) ? item.mediaAssets : []) as Array<Record<string, unknown>>;
    for (const [index, asset] of photos.entries()) {
      const paths = itemArchivePaths(item, asset, index, photos.length);
      move(asset, "imagePath", paths.imagePath);
      move(asset, "thumbnailPath", paths.thumbnailPath);
      if (asset.sourcePath !== null) move(asset, "sourcePath", paths.sourcePath);
    }
  }
  for (const collection of (Array.isArray(copy.collections) ? copy.collections : []) as Array<Record<string, unknown>>) {
    const cover = collection.uploadCover;
    if (cover && typeof cover === "object") {
      const paths = collectionArchivePaths(collection);
      move(cover as Record<string, unknown>, "path", paths.path);
      move(cover as Record<string, unknown>, "thumbnailPath", paths.thumbnailPath);
    }
  }
  if (Object.keys(mapped).length !== Object.keys(assets).length) throw new ArchiveError("The archive contains unreferenced or duplicate media paths.");
  return { inventory: copy, assets: mapped };
}
const manifestSchema = z.object({
  format: z.literal(ARCHIVE_FORMAT), version: z.union([z.literal(2), z.literal(ARCHIVE_VERSION)]), exportedAt: z.string().datetime(), applicationVersion: z.string(),
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

export function readInventoryArchive(input: Uint8Array) {
  if (!input.length || input.length > MAX_ARCHIVE_BYTES) throw new ArchiveError("Archive size is outside the supported limit.");
  const directoryNames = preflightZip(input);
  let files: Record<string, Uint8Array>;
  try { files = unzipSync(input); } catch { throw new ArchiveError("The ZIP archive is damaged or invalid."); }
  const names = Object.keys(files);
  if (names.length < 4 || names.length > MAX_ARCHIVE_ENTRIES || names.length !== directoryNames.size || names.some((name) => !directoryNames.has(name))) throw new ArchiveError("The archive has an invalid number of entries.");
  for (const name of names) {
    if (!safePath(name)) throw new ArchiveError("The archive contains an unsafe path.");
    if (files[name]!.byteLength > MAX_ENTRY_BYTES) throw new ArchiveError("An archive entry exceeds the supported size.");
  }
  const manifestBytes = files["manifest.json"];
  const inventoryBytes = files["inventory.json"];
  const checksumBytes = files["checksums.sha256"];
  if (!manifestBytes || !inventoryBytes || !checksumBytes || !files["README.txt"]) throw new ArchiveError("The archive is missing a required entry.");
  let manifest: z.infer<typeof manifestSchema>;
  let inventory: Record<string, unknown>;
  let rawManifest: unknown;
  try { rawManifest = JSON.parse(Buffer.from(manifestBytes).toString("utf8")); }
  catch { throw new ArchiveError("The archive manifest is invalid."); }
  if (typeof rawManifest !== "object" || rawManifest === null || (rawManifest as Record<string, unknown>).format !== ARCHIVE_FORMAT || ![2, ARCHIVE_VERSION].includes(Number((rawManifest as Record<string, unknown>).version))) throw new ArchiveError("Unsupported archive format. Regenerate the archive from the current All Items installation.");
  try { manifest = manifestSchema.parse(rawManifest); inventory = portableInventorySchema.parse(JSON.parse(Buffer.from(inventoryBytes).toString("utf8"))); }
  catch { throw new ArchiveError("The archive metadata is invalid."); }
  const expected = new Map<string, { size: number; sha256: string }>();
  for (const entry of manifest.entries) {
    if (!safePath(entry.path) || entry.path === "checksums.sha256" || expected.has(entry.path)) throw new ArchiveError("The manifest contains an invalid path.");
    expected.set(entry.path, entry);
  }
  if (expected.size !== names.length - 2 || names.some((name) => name !== "manifest.json" && name !== "checksums.sha256" && !expected.has(name))) throw new ArchiveError("The archive entries do not match the manifest.");
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
  if (manifest.version === 3) for (const item of inventory.items as Array<Record<string, unknown>>) {
    const parsed = z.array(z.string().min(1).max(80)).max(20).safeParse(item.categories);
    if (!parsed.success || new Set(parsed.data).size !== parsed.data.length || parsed.data.some(value => !value.trim() || canonicalCategory(value) !== value)) throw new ArchiveError("An item has invalid category assignments.");
  }
  validateReferences(inventory, files);
  return { manifest, inventory, files };
}

export function verifyInventoryArchive(input: Uint8Array): ArchiveVerification {
  const { manifest, files } = readInventoryArchive(input);
  return { valid: true, format: manifest.format, version: manifest.version, entryCount: Object.keys(files).length };
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
  const names = new Set<string>();
  const equivalent = new Set<string>();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  for (let index = 0; index < entries; index++) {
    if (offset + 46 > input.byteLength || view.getUint32(offset, true) !== 0x02014b50) throw new ArchiveError("The ZIP directory is invalid.");
    const flags = view.getUint16(offset + 8, true);
    const method = view.getUint16(offset + 10, true);
    const compressed = view.getUint32(offset + 20, true);
    const uncompressed = view.getUint32(offset + 24, true);
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const external = view.getUint32(offset + 38, true);
    if (offset + 46 + nameLength + extraLength + commentLength > eocd) throw new ArchiveError("The ZIP directory is invalid.");
    let name: string;
    try { name = decoder.decode(input.subarray(offset + 46, offset + 46 + nameLength)); }
    catch { throw new ArchiveError("The ZIP contains an invalid filename."); }
    if (!safePath(name) || names.has(name) || equivalent.has(pathKey(name))) throw new ArchiveError("The archive contains an unsafe or duplicate path.");
    names.add(name); equivalent.add(pathKey(name));
    const fileType = (external >>> 16) & 0o170000;
    if (fileType && fileType !== 0o100000) throw new ArchiveError("The ZIP contains an unsupported entry type.");
    if ((flags & 1) !== 0 || (method !== 0 && method !== 8) || uncompressed > MAX_ENTRY_BYTES || compressed === 0 && uncompressed > 0 || compressed > 0 && uncompressed / compressed > 100) throw new ArchiveError("The ZIP contains an unsupported or oversized entry.");
    expanded += uncompressed;
    if (expanded > MAX_ARCHIVE_BYTES) throw new ArchiveError("The ZIP expands beyond the supported limit.");
    offset += 46 + nameLength + extraLength + commentLength;
  }
  if (offset !== view.getUint32(eocd + 16, true) + centralSize) throw new ArchiveError("The ZIP directory size is invalid.");
  return names;
}

function validateReferences(inventory: Record<string, unknown>, files: Record<string, Uint8Array>) {
  const assetPaths = new Set<string>();
  const values = Array.isArray(inventory.items) ? inventory.items : [];
  const itemsById = new Map<string, Set<string>>();
  const allMediaIds = new Set<string>();
  const numbers = new Set<string>();
  for (const item of values as Array<Record<string, unknown>>) {
    if (typeof item.id !== "string" || !z.string().uuid().safeParse(item.id).success || !Array.isArray(item.mediaAssets)) throw new ArchiveError("An item has invalid media references.");
    if (itemsById.has(item.id) || typeof item.inventory_number !== "string" || numbers.has(item.inventory_number)) throw new ArchiveError("The archive contains duplicate item identities or inventory numbers.");
    numbers.add(item.inventory_number);
    const mediaIds = new Set<string>();
    let primaryCount = 0;
    for (const asset of item.mediaAssets as Array<Record<string, unknown>>) for (const key of ["imagePath", "thumbnailPath", "sourcePath"]) {
      const value = asset[key];
      if (value === null && key === "sourcePath") continue;
      if (typeof value !== "string" || !safePath(value) || !value.startsWith("Items/") || !files[value] || assetPaths.has(value)) throw new ArchiveError("An item references a missing, shared or unsafe media asset.");
      assetPaths.add(value);
    }
    for (const asset of item.mediaAssets as Array<Record<string, unknown>>) {
      if (typeof asset.id !== "string" || !z.string().uuid().safeParse(asset.id).success || mediaIds.has(asset.id) || allMediaIds.has(asset.id) || typeof asset.isPrimary !== "boolean") throw new ArchiveError("An item has invalid media identity metadata.");
      mediaIds.add(asset.id);
      allMediaIds.add(asset.id);
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
      if (typeof cover.id !== "string" || !z.string().uuid().safeParse(cover.id).success || cover.id !== collection.cover_upload_id || typeof coverPath !== "string" || typeof thumbnailPath !== "string" || !coverPath.startsWith("Collections/") || !thumbnailPath.startsWith("Collections/") || coverPath === thumbnailPath || assetPaths.has(coverPath) || assetPaths.has(thumbnailPath) || !files[coverPath] || !files[thumbnailPath]) throw new ArchiveError("A collection references a missing or unsafe cover.");
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
  const packagedAssets = Object.keys(files).filter((name) => name !== "README.txt" && name !== "manifest.json" && name !== "inventory.json" && name !== "checksums.sha256");
  if ([...assetPaths].some((asset) => !asset.startsWith("Items/") && !asset.startsWith("Collections/")) || packagedAssets.length !== assetPaths.size || packagedAssets.some((asset) => !assetPaths.has(asset))) throw new ArchiveError("The archive contains missing or unreferenced media files.");
}

export function buildInventoryArchive(inventory: Record<string, unknown>, assets: Record<string, Uint8Array> = {}) {
  const entries: Record<string, Uint8Array> = {};
  const canonical = canonicalizeInventory(inventory, assets);
  let totalSize = 0;
  for (const [name, bytes] of Object.entries(canonical.assets)) {
    if (!safePath(name) || (!name.startsWith("Items/") && !name.startsWith("Collections/")) || bytes.byteLength > MAX_ENTRY_BYTES) throw new ArchiveError("An archive asset has an invalid path or size.");
    totalSize += bytes.byteLength;
    if (Object.keys(entries).length + 4 > MAX_ARCHIVE_ENTRIES || totalSize > MAX_ARCHIVE_BYTES) throw new ArchiveError("The inventory exceeds the supported archive limits.");
    entries[name] = bytes;
  }
  const keys = Object.keys(entries).map(pathKey);
  if (new Set(keys).size !== keys.length) throw new ArchiveError("The archive contains colliding media names.");
  entries["README.txt"] = Buffer.from("All Items inventory archive\n\nItem photographs are in Items/. Uploaded collection covers are in Collections/.\nmanifest.json, inventory.json and checksums.sha256 are used by All Items to restore the inventory.\n", "utf8");
  entries["inventory.json"] = Buffer.from(JSON.stringify(canonical.inventory, null, 2), "utf8");
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

export async function createInventoryArchive(context?: { client: Client; directory: string }) {
  const client = context?.client ?? (await getDatabase()).$client;
  const tx = await client.transaction("read");
  let snapshot: Record<string, Array<Record<string, unknown>>>;
  try {
    const workspace = await tx.execute({ sql: "SELECT id, name, created_at, next_inventory_number FROM workspaces WHERE id = ?", args: [workspaceId] });
    const items = await tx.execute({ sql: "SELECT * FROM items WHERE workspace_id = ? ORDER BY inventory_number", args: [workspaceId] });
    const locations = await tx.execute({ sql: "SELECT * FROM locations WHERE workspace_id = ? ORDER BY name", args: [workspaceId] });
    const categoryAssignments = await tx.execute("SELECT ic.* FROM item_categories ic JOIN items i ON i.id=ic.item_id WHERE i.workspace_id='00000000-0000-4000-8000-000000000001' ORDER BY ic.item_id,ic.category");
    const stock = await tx.execute("SELECT * FROM stock_entries ORDER BY item_id, created_at, id");
    const media = await tx.execute("SELECT * FROM media_assets ORDER BY item_id, created_at, id");
    const collections = await tx.execute({ sql: "SELECT * FROM collections WHERE workspace_id = ? ORDER BY created_at, id", args: [workspaceId] });
    const memberships = await tx.execute("SELECT * FROM item_collection_memberships ORDER BY collection_id, item_id");
    const covers = await tx.execute({ sql: `SELECT ca.* FROM collection_cover_assets ca JOIN collections c ON c.id = ca.collection_id
      WHERE c.workspace_id = ? AND c.cover_type = 'upload' AND c.cover_upload_id = ca.id ORDER BY ca.collection_id, ca.id`, args: [workspaceId] });
    snapshot = { categoryAssignments: categoryAssignments.rows as unknown as Array<Record<string, unknown>>, workspaces: workspace.rows as unknown as Array<Record<string, unknown>>, items: items.rows as unknown as Array<Record<string, unknown>>, locations: locations.rows as unknown as Array<Record<string, unknown>>, stock: stock.rows as unknown as Array<Record<string, unknown>>, media: media.rows as unknown as Array<Record<string, unknown>>, collections: collections.rows as unknown as Array<Record<string, unknown>>, memberships: memberships.rows as unknown as Array<Record<string, unknown>>, covers: covers.rows as unknown as Array<Record<string, unknown>> };
    await tx.commit();
  } catch (error) { await tx.rollback(); throw error; }
  const total = snapshot.media.reduce((count, row) => count + (row.source_storage_path ? 3 : 2), 0) + snapshot.covers.length * 2 + 3;
  if (total > MAX_ARCHIVE_ENTRIES) throw new ArchiveError("This inventory contains too many archive entries.");
  const mediaRoot = path.join(context?.directory ?? dataDirectory(), "media");
  const payload: Record<string, unknown> = {
    workspace: snapshot.workspaces[0] ?? null,
    locations: snapshot.locations,
    items: snapshot.items.map((item) => ({ ...item, categories: snapshot.categoryAssignments.filter(row => row.item_id === item.id).map(row => row.category), stock: snapshot.stock.filter((row) => row.item_id === item.id), collectionIds: snapshot.memberships.filter((row) => row.item_id === item.id).map((row) => row.collection_id), mediaAssets: snapshot.media.filter((row) => row.item_id === item.id).map((asset) => ({ id: asset.id, isPrimary: Boolean(asset.is_primary), displayOrder: null, originalFilename: asset.original_filename, mimeType: asset.mime_type, width: asset.width, height: asset.height, cropData: asset.crop_data, createdAt: asset.created_at, imagePath: `media/items/${asset.storage_path}`, thumbnailPath: `media/items/${asset.thumbnail_path}`, sourcePath: asset.source_storage_path ? `media/items/${asset.source_storage_path}` : null })) })),
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
  const columns = ["Inventory number", "Name", "Model", "Brand", "Categories", "Quantity", "Locations", "Identification status", "Sale intent", "Asking price", "Currency", "Description", "Notes"];
  return Buffer.from(`\uFEFF${[columns, ...rows.map((row) => [row.inventory_number, row.name, row.model, row.brand, JSON.stringify(row.categories ?? (row.category ? [row.category] : [])), row.quantity, row.locations, row.identification_status, row.sale_intent, row.asking_price_minor == null ? null : (Number(row.asking_price_minor) / 100).toFixed(2), row.asking_currency, row.description, row.notes])].map((row) => row.map(csvCell).join(",")).join("\r\n")}\r\n`, "utf8");
}

export async function createInventoryCsv() {
  const db = await getDatabase();
  const rows = await db.$client.execute({ sql: `SELECT i.inventory_number, i.name, i.model, i.brand, (SELECT json_group_array(category) FROM (SELECT category FROM item_categories WHERE item_id=i.id ORDER BY category)) AS categories_json, i.identification_status, i.sale_intent, i.asking_price_minor, i.asking_currency, i.description, i.notes, COALESCE(SUM(s.quantity), 0) AS quantity, GROUP_CONCAT(l.name, '; ') AS locations FROM items i LEFT JOIN stock_entries s ON s.item_id = i.id LEFT JOIN locations l ON l.id = s.location_id WHERE i.workspace_id = ? GROUP BY i.id ORDER BY i.inventory_number`, args: [workspaceId] });
  return formatInventoryCsv(rows.rows.map(row => ({ ...row, categories: JSON.parse(String(row.categories_json)) })));
}
