import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type Client } from "@libsql/client";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import sharp from "sharp";
import { unzipSync, zipSync } from "fflate";
import { applyMigrations } from "@/db/migrate";
import { createInventoryArchive, readInventoryArchive, verifyInventoryArchive } from "./archive";
import { importArchiveAsNew, previewInventoryArchive, recoverInventoryImports, restoreInventoryArchive } from "./import";

const workspaceId = "00000000-0000-4000-8000-000000000001";
const itemA = "11111111-1111-4111-8111-111111111111";
const itemB = "22222222-2222-4222-8222-222222222222";
const locationA = "33333333-3333-4333-8333-333333333333";
const locationB = "44444444-4444-4444-8444-444444444444";
const photoId = "55555555-5555-4555-8555-555555555555";
const collectionA = "66666666-6666-4666-8666-666666666666";
const collectionB = "77777777-7777-4777-8777-777777777777";
const coverId = "88888888-8888-4888-8888-888888888888";
const date = "2025-06-12T10:11:12.000Z";
let source: { client: Client; directory: string; workspaceId: string };
let destination: { client: Client; directory: string; workspaceId: string };
let root: string;
let validArchive: Uint8Array;

async function installation(directory: string) {
  await mkdir(directory, { recursive: true });
  const client = createClient({ url: pathToFileURL(path.join(directory, "all-items.db")).href });
  await applyMigrations(client, path.join(process.cwd(), "src/db/migrations"));
  return { client, directory, workspaceId };
}

async function photo(width: number, height: number) {
  return sharp({ create: { width, height, channels: 3, background: "#78a254" } }).webp().toBuffer();
}

async function seed() {
  const c = source.client;
  await c.execute({ sql: "INSERT INTO workspaces (id,name,created_at,next_inventory_number) VALUES (?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,created_at=excluded.created_at,next_inventory_number=excluded.next_inventory_number", args: [workspaceId, "My tools", date, 9] });
  for (const [id, name] of [[locationA, "Shelf A"], [locationB, "箱子"]]) await c.execute({ sql: "INSERT INTO locations (id,workspace_id,name,created_at) VALUES (?,?,?,?)", args: [id, workspaceId, name, date] });
  for (const [id, name, number, mode, category, sale] of [
    [itemA, "FT232RL module", "INV-000001", "unique", "electronics", "considering"],
    [itemB, "智慧手表 🧰", "INV-000008", "bulk", "Власна категорія", "willing_to_sell"],
  ]) await c.execute({ sql: `INSERT INTO items (id,workspace_id,name,model,inventory_number,brand,category,original_marking,notes,description,identification_status,tracking_mode,sale_intent,asking_price_minor,asking_currency,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, args: [id, workspaceId, name, null, number, null, category, null, "Synthetic note", "Synthetic description", "user_confirmed", mode, sale, 1250, "EUR", date, date] });
  for (const [item,category] of [[itemA,"electronics"],[itemA,"tools"],[itemB,"Custom category"]]) await c.execute({ sql: "INSERT INTO item_categories (item_id,category) VALUES (?,?)", args: [item,category] });
  for (const [id, item, location, quantity] of [[randomUUID(), itemA, locationA, 1], [randomUUID(), itemB, locationA, 2], [randomUUID(), itemB, locationB, 3]]) await c.execute({ sql: "INSERT INTO stock_entries (id,item_id,location_id,quantity,created_at,updated_at) VALUES (?,?,?,?,?,?)", args: [id, item, location, quantity, date, date] });
  const crop = JSON.stringify({ x: 0, y: 0, width: 64, height: 64, rotate: 0, scaleX: 1, scaleY: 1 });
  await c.execute({ sql: "INSERT INTO media_assets (id,item_id,storage_path,thumbnail_path,source_storage_path,crop_data,original_filename,mime_type,width,height,created_at,is_primary) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)", args: [photoId, itemA, `${itemA}/${photoId}.webp`, `${itemA}/${photoId}-thumb.webp`, `${itemA}/${photoId}-source.webp`, crop, "synthetic.png", "image/webp", 64, 64, date, 1] });
  for (const [id, name, type, icon] of [[collectionA, "DIY", "upload", "🛠️", coverId], [collectionB, "Подарки", "emoji", "🎁", null]]) await c.execute({ sql: "INSERT INTO collections (id,workspace_id,name,normalized_name,created_at,updated_at,icon,cover_type,cover_icon,cover_upload_id) VALUES (?,?,?,?,?,?,?,?,?,?)", args: [id, workspaceId, name, String(name).toLowerCase(), date, date, icon, type === "upload" ? "default" : type, type === "emoji" ? icon : null, null] });
  await c.execute({ sql: "INSERT INTO collection_cover_assets (id,collection_id,storage_path,thumbnail_path,width,height,created_at) VALUES (?,?,?,?,?,?,?)", args: [coverId, collectionA, `collections/${collectionA}/${coverId}.webp`, `collections/${collectionA}/${coverId}-thumb.webp`, 80, 50, date] });
  await c.execute({sql:"UPDATE collections SET cover_type='upload',cover_upload_id=? WHERE id=?",args:[coverId,collectionA]});
  for (const [collection, item] of [[collectionA, itemA], [collectionA, itemB], [collectionB, itemB]]) await c.execute({ sql: "INSERT INTO item_collection_memberships (id,collection_id,item_id,created_at) VALUES (?,?,?,?)", args: [randomUUID(), collection, item, date] });
  const files = [
    [`media/items/${itemA}/${photoId}.webp`, await photo(64, 64)], [`media/items/${itemA}/${photoId}-thumb.webp`, await photo(32, 32)], [`media/items/${itemA}/${photoId}-source.webp`, await photo(100, 100)],
    [`media/collections/${collectionA}/${coverId}.webp`, await photo(80, 50)], [`media/collections/${collectionA}/${coverId}-thumb.webp`, await photo(40, 25)],
  ] as const;
  for (const [relative, bytes] of files) { const full = path.join(source.directory, relative); await mkdir(path.dirname(full), { recursive: true }); await writeFile(full, bytes); }
}

function modifiedArchive(edit: (files: Record<string, Uint8Array>) => void) {
  const files = unzipSync(validArchive);
  edit(files);
  const manifest = JSON.parse(Buffer.from(files["manifest.json"]!).toString("utf8")) as { entries: Array<{ path: string; size: number; sha256: string }> };
  for (const entry of manifest.entries) if (files[entry.path]) { entry.size = files[entry.path]!.byteLength; entry.sha256 = createHash("sha256").update(files[entry.path]!).digest("hex"); }
  files["manifest.json"] = Buffer.from(JSON.stringify(manifest));
  files["checksums.sha256"] = Buffer.from(manifest.entries.map((entry) => `${entry.sha256}  ${entry.path}`).join("\n") + "\n");
  return zipSync(files, { level: 0 });
}

async function emptyDestination() {
  const count = await destination.client.execute("SELECT COUNT(*) AS count FROM items");
  expect(Number(count.rows[0]!.count)).toBe(0);
  const collections = await destination.client.execute("SELECT COUNT(*) AS count FROM collections");
  expect(Number(collections.rows[0]!.count)).toBe(0);
}

beforeAll(async () => {
  root = await mkdtemp(path.join(os.tmpdir(), "all-items-import-test-"));
  source = await installation(path.join(root, "source"));
  destination = await installation(path.join(root, "destination"));
  await seed();
  validArchive = await createInventoryArchive(source,source);
},30_000);
afterAll(async () => { await source?.client.close(); await destination?.client.close(); if (root) try { await rm(root, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 }); } catch (error) { if (!(error instanceof Error && "code" in error && error.code === "EBUSY")) throw error; } }, 30_000);

describe("current and transitional archive restore", () => {
  it("rejects malformed, unsupported and inconsistent archives without changing the installation", async () => {
    await expect(previewInventoryArchive(new Uint8Array([1, 2, 3]))).rejects.toThrow();
    const old = modifiedArchive((files) => { const manifest = JSON.parse(Buffer.from(files["manifest.json"]!).toString("utf8")) as { version: number }; manifest.version = 1; files["manifest.json"] = Buffer.from(JSON.stringify(manifest)); });
    await expect(previewInventoryArchive(old)).rejects.toThrow(/Unsupported archive format/);
    const checksum = unzipSync(validArchive); checksum["README.txt"]![0] ^= 1;
    await expect(previewInventoryArchive(zipSync(checksum, { level: 0 }))).rejects.toThrow(/integrity check failed/);
    const missing = unzipSync(validArchive); delete missing[Object.keys(missing).find((name) => name.endsWith("main.webp"))!];
    await expect(previewInventoryArchive(zipSync(missing, { level: 0 }))).rejects.toThrow();
    const broken = modifiedArchive((files) => { const inventory = JSON.parse(Buffer.from(files["inventory.json"]!).toString("utf8")) as { memberships: Array<{ item_id: string }> }; inventory.memberships[0]!.item_id = randomUUID(); files["inventory.json"] = Buffer.from(JSON.stringify(inventory)); });
    await expect(previewInventoryArchive(broken)).rejects.toThrow();
    const badMode = modifiedArchive((files) => { const inventory = JSON.parse(Buffer.from(files["inventory.json"]!).toString("utf8")) as { items: Array<{ tracking_mode: string }> }; inventory.items[0]!.tracking_mode = "wrong"; files["inventory.json"] = Buffer.from(JSON.stringify(inventory)); });
    await expect(previewInventoryArchive(badMode)).rejects.toThrow();
    await emptyDestination();
  });

  it("restores the unchanged revision 2 schema through the transition adapter", async () => {
    const revision2 = modifiedArchive(files => {
      const manifest = JSON.parse(Buffer.from(files["manifest.json"]!).toString("utf8")); manifest.version=2; files["manifest.json"]=Buffer.from(JSON.stringify(manifest));
      const inventory=JSON.parse(Buffer.from(files["inventory.json"]!).toString("utf8"));
      for (const item of inventory.items) {
        delete item.categories;
        for (const media of item.mediaAssets) for (const [key,suffix] of [["imagePath","main"],["thumbnailPath","thumbnail"],["sourcePath","editable"]]) {
          const old = media[key];
          if (!old) continue;
          const historical = `Items/${item.inventory_number} - ${item.name}/${item.name} - ${media.id.slice(0,8)} - ${suffix}.webp`;
          files[historical] = files[old]!; delete files[old]; media[key] = historical;
          manifest.entries.find((entry: {path:string}) => entry.path === old).path = historical;
        }
      }
      files["manifest.json"]=Buffer.from(JSON.stringify(manifest));
      files["inventory.json"]=Buffer.from(JSON.stringify(inventory));
    });
    const target=await installation(path.join(root,"revision2"));
    try {
      await restoreInventoryArchive(revision2,target);
      expect((await target.client.execute("SELECT category FROM item_categories ORDER BY category")).rows.map(row => row.category)).toEqual(expect.arrayContaining(["electronics"]));
      expect((await target.client.execute("SELECT COUNT(*) AS n FROM items")).rows[0]!.n).toBe(2);
      const exported=readInventoryArchive(await createInventoryArchive(target,target));
      expect(exported.manifest.version).toBe(4);
      expect((exported.inventory.items as Array<{categories: string[]}>)[0]!.categories).toContain("electronics");
    } finally { target.client.close(); }
  });

  it("rolls back failures while staging, preparing and promoting files", async () => {
    for (const fault of ["stage", "prepare", "promote"] as const) {
      await expect(restoreInventoryArchive(validArchive, destination, fault)).rejects.toThrow();
      await emptyDestination();
    }
  });

  it("recovers an interrupted promotion and restores all records and media into an empty installation", async () => {
    const stage = path.join(destination.directory, `.import-${randomUUID()}`);
    const orphan = `media/items/${itemA}/${photoId}.webp`;
    await mkdir(stage);
    await writeFile(path.join(stage, "journal.json"), JSON.stringify([orphan]));
    const orphanFull = path.join(destination.directory, orphan);
    await mkdir(path.dirname(orphanFull), { recursive: true });
    await writeFile(orphanFull, "interrupted");
    const preview = await previewInventoryArchive(validArchive);
    expect(preview).toMatchObject({ items: 2, collections: 2, photos: 1 });
    await restoreInventoryArchive(validArchive, destination);
    for (const table of ["workspaces", "items", "locations", "stock_entries", "media_assets", "collections", "collection_cover_assets", "item_collection_memberships", "item_categories"]) {
      const original = await source.client.execute(`SELECT * FROM ${table} ORDER BY ${table === "item_categories" ? "item_id,category" : "id"}`);
      const restored = await destination.client.execute(`SELECT * FROM ${table} ORDER BY ${table === "item_categories" ? "item_id,category" : "id"}`);
      expect(restored.rows).toEqual(original.rows);
    }
    const { inventory, files } = readInventoryArchive(validArchive);
    const restoredArchive = await createInventoryArchive(destination,destination);
    const restored = readInventoryArchive(restoredArchive);
    expect(restored.inventory).toEqual(inventory);
    for (const [name, bytes] of Object.entries(files)) if (name.startsWith("Items/") || name.startsWith("Collections/")) expect(createHash("sha256").update(restored.files[name]!).digest("hex")).toBe(createHash("sha256").update(bytes).digest("hex"));
    expect(verifyInventoryArchive(restoredArchive).valid).toBe(true);
    const next = await destination.client.execute("SELECT next_inventory_number FROM workspaces WHERE id = '00000000-0000-4000-8000-000000000001'");
    expect(Number(next.rows[0]!.next_inventory_number)).toBe(9);
    await expect(restoreInventoryArchive(validArchive, destination)).rejects.toThrow(/empty inventory/);
    expect((await readFile(orphanFull)).byteLength).toBeGreaterThan(0);
  });
});

async function mediaHashes(directory:string) {
  const result:Record<string,string>={};
  async function walk(folder:string) {
    for(const entry of await readdir(folder,{withFileTypes:true})) {
      const full=path.join(folder,entry.name);
      if(entry.isDirectory())await walk(full);
      else if(entry.isFile())result[path.relative(directory,full)]=createHash("sha256").update(await readFile(full)).digest("hex");
    }
  }
  try{await walk(path.join(directory,"media"));}catch(error){if(!(error instanceof Error && "code" in error && error.code==="ENOENT"))throw error;}
  return result;
}

describe("non-destructive imports",()=>{
  it("rejects a duplicate name without modifying existing inventories or media",async()=>{
    const existing=(await destination.client.execute("SELECT name FROM workspaces ORDER BY id LIMIT 1")).rows[0]!.name as string;
    const before=(await destination.client.execute("SELECT * FROM workspaces ORDER BY id")).rows;
    const media=await mediaHashes(destination.directory);
    await expect(importArchiveAsNew(destination,validArchive,` ${existing.toLocaleUpperCase("ru-RU")} `,destination)).rejects.toThrow("Inventory name already exists");
    expect((await destination.client.execute("SELECT * FROM workspaces ORDER BY id")).rows).toEqual(before);
    expect(await mediaHashes(destination.directory)).toEqual(media);
  },20_000);
  it("imports the same archive twice into populated storage with fresh identities and unchanged original records and media",async()=>{
    const before=readInventoryArchive(await createInventoryArchive(destination,destination));
    const beforeMedia=await mediaHashes(destination.directory);
    const results=[];
    for(const name of ["Imported one","Imported two"])results.push(await importArchiveAsNew(destination,validArchive,name,destination));
    expect(results[0]!.inventoryId).not.toBe(results[1]!.inventoryId);
    const original=readInventoryArchive(validArchive);
    const allIds=new Set<string>();
    for(const result of results) {
      const restored=readInventoryArchive(await createInventoryArchive({workspaceId:result.inventoryId},destination));
      const inventory=restored.inventory;
      const sourceInventory=original.inventory;
      const oldIds=new Set<string>();
      const collect=(value:unknown)=>{if(typeof value==="string" && /^[0-9a-f-]{36}$/i.test(value))oldIds.add(value);else if(Array.isArray(value))value.forEach(collect);else if(value && typeof value==="object")Object.values(value).forEach(collect);};
      collect(sourceInventory);
      for(const old of oldIds)expect(JSON.stringify(inventory)).not.toContain(old);
      expect(inventory.workspace).toMatchObject({id:result.inventoryId,name:result.name,next_inventory_number:9,created_at:date});
      for(const table of ["items","locations","collections","memberships"] as const) {
        const imported=inventory[table] as Array<{id:string}>;
        expect(imported).toHaveLength((sourceInventory[table] as unknown[]).length);
        for(const row of imported){expect(allIds.has(row.id)).toBe(false);allIds.add(row.id);}
      }
      const importedItems=inventory.items as Array<Record<string,unknown>>;
      const originalItems=sourceInventory.items as Array<Record<string,unknown>>;
      const importedItemIds=new Set(importedItems.map(item=>item.id));
      for(const item of importedItems) {
        const prior=originalItems.find(prior=>prior.inventory_number===item.inventory_number)!;
        for(const key of ["inventory_number","name","model","brand","categories","category","original_marking","notes","description","tracking_mode","identification_status","sale_intent","asking_price_minor","asking_currency","created_at","updated_at"])expect(item[key]).toEqual(prior[key]);
        const stock=item.stock as Array<{id:string;item_id:string;quantity:number}>;
        const located=(rows:unknown,locations:unknown)=>(rows as Array<{location_id:string|null;quantity:number}>).map(row=>({quantity:row.quantity,location:row.location_id?(locations as Array<{id:string;name:string}>).find(location=>location.id===row.location_id)!.name:null})).sort((a,b)=>String(a.location).localeCompare(String(b.location)));
        expect(located(stock,inventory.locations)).toEqual(located(prior.stock,sourceInventory.locations));
        for(const row of stock){expect(row.item_id).toBe(item.id);expect(allIds.has(row.id)).toBe(false);allIds.add(row.id);}
        const photos=item.mediaAssets as Array<Record<string,unknown>>;
        for(const [index,photo] of photos.entries()) {
          const old=(prior.mediaAssets as Array<Record<string,unknown>>)[index]!;
          for(const key of ["cropData","width","height","createdAt","isPrimary","originalFilename"])expect(photo[key]).toEqual(old[key]);
          expect(allIds.has(String(photo.id))).toBe(false);allIds.add(String(photo.id));
          for(const key of ["imagePath","thumbnailPath","sourcePath"])if(photo[key])expect(restored.files[String(photo[key])]).toEqual(original.files[String(old[key])]);
        }
      }
      for(const collection of inventory.collections as Array<Record<string,unknown>>) {
        for(const id of collection.itemIds as string[])expect(importedItemIds.has(id)).toBe(true);
        const old=(sourceInventory.collections as Array<Record<string,unknown>>).find(row=>row.name===collection.name)!;
        if(collection.uploadCover) {
          const cover=collection.uploadCover as Record<string,string>,oldCover=old.uploadCover as Record<string,string>;
          expect(cover.id).not.toBe(oldCover.id);
          expect(restored.files[cover.path!]).toEqual(original.files[oldCover.path!]);
          expect(restored.files[cover.thumbnailPath!]).toEqual(original.files[oldCover.thumbnailPath!]);
        }
      }
    }
    const after=readInventoryArchive(await createInventoryArchive(destination,destination));
    expect(after.inventory).toEqual(before.inventory);
    for(const [file,hash]of Object.entries(beforeMedia))expect((await mediaHashes(destination.directory))[file]).toBe(hash);
    expect((await destination.client.execute("PRAGMA foreign_key_check")).rows).toHaveLength(0);
  },30_000);

  it("isolates staging, promotion and transaction failures and retains the source archive for recovery",async()=>{
    const before=(await destination.client.execute("SELECT * FROM workspaces ORDER BY id")).rows;
    const media=await mediaHashes(destination.directory);
    for(const fault of ["stage","prepare","promote","transaction"] as const) {
      await expect(importArchiveAsNew(destination,validArchive,`Failed ${fault}`,destination,fault)).rejects.toThrow();
      expect((await destination.client.execute("SELECT * FROM workspaces ORDER BY id")).rows).toEqual(before);
      expect(await mediaHashes(destination.directory)).toEqual(media);
    }
    const recovery=path.join(destination.directory,"recovery");
    const retained=(await readdir(recovery)).filter(name=>name.startsWith(".import-"));
    expect(retained.length).toBeGreaterThanOrEqual(4);
    let sources=0;
    for(const entry of retained) {
      const state=JSON.parse(await readFile(path.join(recovery,entry,"recovery.json"),"utf8"));
      if(state.status==="failed-import-cleaned"){expect(await readFile(path.join(recovery,entry,"source.zip"))).toEqual(Buffer.from(validArchive));sources++;}
    }
    expect(sources).toBeGreaterThanOrEqual(4);
  },30_000);

  it("recovers interrupted uncommitted promotion and preserves a fully committed import",async()=>{
    const count=Number((await destination.client.execute("SELECT COUNT(*) AS n FROM workspaces")).rows[0]!.n);
    const hashes=await mediaHashes(destination.directory);
    await expect(importArchiveAsNew(destination,validArchive,"Interrupted",destination,"interrupt")).rejects.toThrow();
    expect(Number((await destination.client.execute("SELECT COUNT(*) AS n FROM workspaces")).rows[0]!.n)).toBe(count);
    expect((await readdir(destination.directory)).some(name=>name.startsWith(".import-"))).toBe(true);
    await recoverInventoryImports(destination.client,destination.directory);
    expect(await mediaHashes(destination.directory)).toEqual(hashes);
    await expect(importArchiveAsNew(destination,validArchive,"Committed interruption",destination,"after-commit")).rejects.toThrow();
    expect(Number((await destination.client.execute("SELECT COUNT(*) AS n FROM workspaces")).rows[0]!.n)).toBe(count+1);
    const committed=await mediaHashes(destination.directory);
    await recoverInventoryImports(destination.client,destination.directory);
    expect(await mediaHashes(destination.directory)).toEqual(committed);
    expect((await readdir(destination.directory)).some(name=>name.startsWith(".import-"))).toBe(false);
  },30_000);

  it("serializes concurrent imports and accepts original revision 2/3 contracts as new inventories",async()=>{
    const results=await Promise.all([importArchiveAsNew(destination,validArchive,"Concurrent A",destination),importArchiveAsNew(destination,validArchive,"Concurrent B",destination)]);
    expect(results[0].inventoryId).not.toBe(results[1].inventoryId);
    for(const version of [2,3]) {
      const legacy=modifiedArchive(files=>{
        const manifest=JSON.parse(Buffer.from(files["manifest.json"]!).toString());manifest.version=version;files["manifest.json"]=Buffer.from(JSON.stringify(manifest));
        if(version===2){const inventory=JSON.parse(Buffer.from(files["inventory.json"]!).toString());for(const item of inventory.items)delete item.categories;files["inventory.json"]=Buffer.from(JSON.stringify(inventory));}
      });
      const result=await importArchiveAsNew(destination,legacy,`Revision ${version}`,destination);
      expect(result.items).toBe(2);
    }
    const before=await mediaHashes(destination.directory);
    await expect(importArchiveAsNew(destination,new Uint8Array([1,2,3]),"Invalid",destination)).rejects.toThrow();
    expect(await mediaHashes(destination.directory)).toEqual(before);
  },30_000);

  it("refuses linked private destinations before promoting any files",async()=>{
    const target=await installation(path.join(root,"linked"));
    const outside=path.join(root,"outside");await mkdir(outside);await mkdir(path.join(target.directory,"media"));
    try {
      await symlink(outside,path.join(target.directory,"media","items"),process.platform==="win32"?"junction":"dir");
      await expect(importArchiveAsNew(target,validArchive,"Linked",target)).rejects.toThrow(/filesystem path/);
      expect(await readdir(outside)).toEqual([]);
      expect(Number((await target.client.execute("SELECT COUNT(*) AS n FROM workspaces")).rows[0]!.n)).toBe(1);
    } finally {target.client.close();}
  });
});
