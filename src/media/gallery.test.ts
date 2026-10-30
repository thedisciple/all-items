import { beforeAll, describe, expect, it } from "vitest";
import { createClient } from "@libsql/client";
import { copyFile, mkdtemp, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createHash, randomUUID } from "node:crypto";
import sharp from "sharp";
import { createInventoryArchive, readInventoryArchive, verifyInventoryArchive } from "@/export/archive";
import { importArchiveAsNew, type PortableInventory } from "@/export/import";
import { applyMigrations } from "@/db/migrate";
import { createMigrationBackup } from "@/db/backup";
import { createItem, getItem } from "@/items/service";
import { addItemToCollection, createCollection, getCollection, listCollectionCoverOptions, setCollectionCover } from "@/items/collections";
import { addItemPhoto, createItemWithPhoto, getPrimaryPhoto, listItemPhotos, readItemPhoto, removeItemPhoto, reorderItemPhotos, replaceItemPhoto, setItemPrimaryPhoto } from "./service";

const inventory = { workspaceId: "00000000-0000-4000-8000-000000000001" };
const foreign = { workspaceId: randomUUID() };
let directory: string;
let client: ReturnType<typeof createClient>;
let legacyId: string;
let beforeMedia: Record<string, unknown>[];
let beforeBytes: string;
let beforeItems: Record<string, unknown>[];
let legacyPhoto: string;
let backup: string;
const hash = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
async function image(color = "#56816c") {
  const bytes = await sharp({ create: { width: 320, height: 240, channels: 3, background: color } }).png().toBuffer();
  return new File([new Uint8Array(bytes)], "synthetic.png", { type: "image/png" });
}

beforeAll(async () => {
  directory = await mkdtemp(path.join(os.tmpdir(), "all-items-gallery-"));
  process.env.ALL_ITEMS_DATA_DIR = directory;
  client = createClient({ url: pathToFileURL(path.join(directory, "all-items.db")).href });
  const migrations = path.join(process.cwd(), "src/db/migrations");
  const legacy = path.join(directory, "legacy"); await mkdir(legacy);
  for (const name of (await readdir(migrations)).filter(name => name < "0011")) await copyFile(path.join(migrations, name), path.join(legacy, name));
  await applyMigrations(client, legacy);
  legacyId = randomUUID(); legacyPhoto = randomUUID();
  await client.execute({sql:"INSERT INTO items(id,workspace_id,name,inventory_number,asking_price_minor,asking_currency,created_at,updated_at) VALUES(?,?,?,?,1234,'HUF',?,?)",args:[legacyId,inventory.workspaceId,"Synthetic preserved legacy","INV-000001","2026-01-01","2026-01-01"]});
  await client.execute({sql:"INSERT INTO stock_entries(id,item_id,quantity,created_at,updated_at) VALUES(?,?,1,?,?)",args:[randomUUID(),legacyId,"2026-01-01","2026-01-01"]});
  await client.execute({sql:"UPDATE workspaces SET next_inventory_number=2 WHERE id=?",args:[inventory.workspaceId]});
  const bytes = await sharp({create:{width:320,height:240,channels:3,background:"#56816c"}}).webp().toBuffer();
  const mediaFolder = path.join(directory,"media","items",legacyId); await mkdir(mediaFolder,{recursive:true});
  await writeFile(path.join(mediaFolder,legacyPhoto+".webp"),bytes); await writeFile(path.join(mediaFolder,legacyPhoto+"-thumb.webp"),bytes);
  await client.execute({sql:"INSERT INTO media_assets(id,item_id,storage_path,thumbnail_path,original_filename,mime_type,width,height,created_at,is_primary) VALUES(?,?,?,?,?,'image/webp',320,240,?,1)",args:[legacyPhoto,legacyId,legacyId+"/"+legacyPhoto+".webp",legacyId+"/"+legacyPhoto+"-thumb.webp","legacy.webp","2026-01-01"]});
  beforeItems = (await client.execute("SELECT * FROM items ORDER BY id")).rows as unknown as Record<string,unknown>[];
  beforeMedia = (await client.execute("SELECT * FROM media_assets ORDER BY id")).rows as unknown as Record<string, unknown>[];
  legacyPhoto = String(beforeMedia[0]!.id);
  beforeBytes = hash((await readItemPhoto(inventory, legacyId, legacyPhoto, "image"))!);
  backup = await createMigrationBackup(client, directory);
  await applyMigrations(client, migrations); await applyMigrations(client, migrations);
  await client.execute({ sql: "INSERT INTO workspaces(id,name,created_at) VALUES(?,?,?)", args: [foreign.workspaceId, "Synthetic other", "2026-01-01"] });
}, 30_000);

describe("ordered private item photos", () => {
  it("preserves legacy columns, identities and media bytes through a verified repeatable migration", async () => {
    const after = (await client.execute(`SELECT ${Object.keys(beforeMedia[0]!).join(",")} FROM media_assets ORDER BY id`)).rows;
    expect(after).toEqual(beforeMedia);
    expect((await client.execute(`SELECT ${Object.keys(beforeItems[0]!).join(",")} FROM items ORDER BY id`)).rows).toEqual(beforeItems);
    expect(await getItem(inventory,legacyId)).toMatchObject({asking_price_minor:1234,asking_currency:"HUF",asking_price_exponent:2});
    expect(await readItemPhoto(inventory,legacyId,legacyPhoto,"source")).toEqual(await readItemPhoto(inventory,legacyId,legacyPhoto,"image"));
    expect(hash((await readItemPhoto(inventory, legacyId, legacyPhoto, "image"))!)).toBe(beforeBytes);
    const checksums = JSON.parse(await readFile(path.join(backup, "verified-sha256.json"), "utf8"));
    expect(checksums[`media/items/${legacyId}/${legacyPhoto}.webp`]).toBe(beforeBytes);
    expect(await listItemPhotos(inventory, legacyId)).toMatchObject([{ id: legacyPhoto, displayOrder: 0, isPrimary: true }]);
    expect((await client.execute("PRAGMA integrity_check")).rows[0]!.integrity_check).toBe("ok");
    expect((await client.execute("PRAGMA foreign_key_check")).rows).toHaveLength(0);
  });

  it("adds, orders, promotes, replaces independently and deterministically deletes the primary", async () => {
    const item = await createItem(inventory, { name: "Synthetic gallery" });
    const first = await addItemPhoto(inventory, item.id, await image());
    const second = await addItemPhoto(inventory, item.id, await image("#a47755"));
    const third = await addItemPhoto(inventory, item.id, await image("#566c9b"));
    const retained = hash((await readItemPhoto(inventory, item.id, first.id, "image"))!);
    expect((await getPrimaryPhoto(inventory, item.id))?.id).toBe(first.id);
    await setItemPrimaryPhoto(inventory, item.id, second.id);
    await reorderItemPhotos(inventory, item.id, [third.id, second.id, first.id]);
    expect((await listItemPhotos(inventory, item.id)).map(photo => photo.id)).toEqual([third.id, second.id, first.id]);
    expect((await getItem(inventory, item.id))?.primary_media_id).toBe(second.id);
    const replacement = await replaceItemPhoto(inventory, item.id, third.id, await image("#bbae45"));
    expect((await listItemPhotos(inventory, item.id)).map(photo => photo.id)).toEqual([replacement.id, second.id, first.id]);
    expect(hash((await readItemPhoto(inventory, item.id, first.id, "image"))!)).toBe(retained);
    await removeItemPhoto(inventory, item.id, second.id);
    expect((await getPrimaryPhoto(inventory, item.id))?.id).toBe(replacement.id);
    expect((await listItemPhotos(inventory, item.id)).map(photo => photo.displayOrder)).toEqual([0, 1]);
    await expect(reorderItemPhotos(inventory, item.id, [first.id, first.id])).rejects.toThrow();
    await expect(client.execute({ sql: "UPDATE media_assets SET is_primary=1 WHERE id=?", args: [first.id] })).rejects.toThrow();
    await expect(client.execute({ sql: "UPDATE media_assets SET display_order=0 WHERE id=?", args: [first.id] })).rejects.toThrow();
    await removeItemPhoto(inventory, item.id, replacement.id); await removeItemPhoto(inventory, item.id, first.id);
    expect(await listItemPhotos(inventory, item.id)).toEqual([]);
    expect(await getPrimaryPhoto(inventory, item.id)).toBeNull();
  });

  it("keeps selected non-primary collection covers through reorder and replacement, then resets on deletion", async () => {
    const second = await addItemPhoto(inventory, legacyId, await image());
    const collection = await createCollection(inventory, { name: "Synthetic gallery cover" });
    await addItemToCollection(inventory, collection.id, legacyId);
    expect(await listCollectionCoverOptions(inventory, collection.id)).toHaveLength(2);
    await setCollectionCover(inventory, collection.id, { type: "item_photo", itemId: legacyId, mediaId: second.id });
    await reorderItemPhotos(inventory, legacyId, [second.id, legacyPhoto]);
    expect((await getCollection(inventory, collection.id))?.coverMediaId).toBe(second.id);
    const replacement = await replaceItemPhoto(inventory, legacyId, second.id, await image("#ad5959"));
    expect((await getCollection(inventory, collection.id))?.coverMediaId).toBe(replacement.id);
    expect(await readItemPhoto(inventory, legacyId, replacement.id, "image")).not.toBeNull();
    await removeItemPhoto(inventory, legacyId, replacement.id);
    expect((await getCollection(inventory, collection.id))?.coverType).toBe("default");
    expect((await getPrimaryPhoto(inventory, legacyId))?.id).toBe(legacyPhoto);
  });

  it("serializes concurrent additions into distinct positions with one primary", async () => {
    const item = await createItem(inventory, {name:"Synthetic concurrent gallery"});
    const file = await image();
    const added = await Promise.all([addItemPhoto(inventory,item.id,file),addItemPhoto(inventory,item.id,file),addItemPhoto(inventory,item.id,file)]);
    const photos = await listItemPhotos(inventory,item.id);
    expect(photos.map(photo=>photo.id).sort()).toEqual(added.map(photo=>photo.id).sort());
    expect(photos.map(photo=>photo.displayOrder)).toEqual([0,1,2]);
    expect(photos.filter(photo=>photo.isPrimary)).toHaveLength(1);
  });

  it("rejects foreign ownership and preserves previous media on processing and transaction failure", async () => {
    const before = await listItemPhotos(inventory, legacyId);
    const bytes = hash((await readItemPhoto(inventory, legacyId, legacyPhoto, "image"))!);
    expect(await listItemPhotos(foreign, legacyId)).toEqual([]);
    expect(await readItemPhoto(foreign, legacyId, legacyPhoto, "source")).toBeNull();
    await expect(addItemPhoto(foreign, legacyId, await image())).rejects.toThrow();
    await expect(setItemPrimaryPhoto(foreign, legacyId, legacyPhoto)).rejects.toThrow();
    await expect(removeItemPhoto(foreign, legacyId, legacyPhoto)).rejects.toThrow();
    await expect(reorderItemPhotos(foreign, legacyId, [legacyPhoto])).rejects.toThrow();
    await expect(replaceItemPhoto(foreign, legacyId, legacyPhoto, await image())).rejects.toThrow();
    await expect(replaceItemPhoto(inventory, legacyId, legacyPhoto, new File(["bad"], "bad.png", { type: "image/png" }))).rejects.toThrow();
    await client.execute("CREATE TRIGGER gallery_synthetic_failure BEFORE INSERT ON media_assets BEGIN SELECT RAISE(ABORT,'synthetic media failure'); END");
    try { await expect(replaceItemPhoto(inventory, legacyId, legacyPhoto, await image())).rejects.toThrow(); }
    finally { await client.execute("DROP TRIGGER gallery_synthetic_failure"); }
    expect(await listItemPhotos(inventory, legacyId)).toEqual(before);
    expect(hash((await readItemPhoto(inventory, legacyId, legacyPhoto, "image"))!)).toBe(bytes);
  });
});


it("round-trips an ordered gallery twice as new inventories with exact media bytes and remapped covers", async () => {
  const source = await image("#758a96");
  const item = await createItemWithPhoto(inventory,{name:"",model:"Synthetic portable unnamed",askingPrice:"12.345",askingCurrency:"KWD"},source);
  const first = (await getPrimaryPhoto(inventory,item.id))!;
  const second = await addItemPhoto(inventory,item.id,await image("#937667"));
  const crop = {x:10,y:10,width:120,height:100,rotate:0,scaleX:1,scaleY:1};
  const derivative = await sharp(Buffer.from(await source.arrayBuffer())).extract({left:10,top:10,width:120,height:100}).png().toBuffer();
  const third = await addItemPhoto(inventory,item.id,new File([new Uint8Array(derivative)],"synthetic-crop.png",{type:"image/png"}),source,JSON.stringify(crop));
  await setItemPrimaryPhoto(inventory,item.id,second.id);
  await reorderItemPhotos(inventory,item.id,[third.id,first.id,second.id]);
  const collection = await createCollection(inventory,{name:"Synthetic portable gallery cover"});
  await addItemToCollection(inventory,collection.id,item.id);
  await setCollectionCover(inventory,collection.id,{type:"item_photo",itemId:item.id,mediaId:first.id});
  const bytes = await createInventoryArchive(inventory,{client,directory});
  expect(verifyInventoryArchive(bytes).version).toBe(6);
  const original = readInventoryArchive(bytes);
  const records = original.inventory as PortableInventory;
  const archivedItem = records.items.find(row=>row.id===item.id)!;
  expect(archivedItem.name).toBe("");
  expect([archivedItem.asking_price_minor,archivedItem.asking_currency]).toEqual([12345,"KWD"]);
  expect(archivedItem.primaryMediaId).toBe(second.id);
  expect(archivedItem.mediaAssets.map(photo=>photo.id)).toEqual([third.id,first.id,second.id]);
  expect(archivedItem.mediaAssets[0]!.imagePath).toMatch(/photo-01.webp$/);
  const identities: string[][]=[];
  for(const name of ["Synthetic gallery restore one","Synthetic gallery restore two"]) {
    const imported = await importArchiveAsNew(inventory,bytes,name,{client,directory});
    const target = {workspaceId:imported.inventoryId};
    const restored = readInventoryArchive(await createInventoryArchive(target,{client,directory})).inventory as PortableInventory;
    const restoredItem = restored.items.find(row=>row.inventory_number===archivedItem.inventory_number)!;
    identities.push(restoredItem.mediaAssets.map(photo=>photo.id));
    expect(restoredItem.name).toBe("");
    expect([restoredItem.asking_price_minor,restoredItem.asking_currency]).toEqual([12345,"KWD"]);
    expect(restoredItem.mediaAssets.map(photo=>photo.displayOrder)).toEqual([0,1,2]);
    expect(restoredItem.mediaAssets.map(photo=>photo.isPrimary)).toEqual([false,false,true]);
    expect(restoredItem.mediaAssets[0]!.cropData).toBe(JSON.stringify(crop));
    expect(restoredItem.primaryMediaId).toBe(restoredItem.mediaAssets[2]!.id);
    for(const [position,photo] of archivedItem.mediaAssets.entries()) for(const variant of ["image","thumbnail","source"]) {
      expect(hash((await readItemPhoto(target,restoredItem.id,restoredItem.mediaAssets[position]!.id,variant))!)).toBe(hash((await readItemPhoto(inventory,item.id,photo.id,variant))!));
    }
    const restoredCover = restored.collections.find(row=>row.name==="Synthetic portable gallery cover")!;
    expect(restoredCover.cover_media_id).toBe(restoredItem.mediaAssets[1]!.id);
    const reordered = restoredItem.mediaAssets.map(photo=>photo.id).reverse();
    await reorderItemPhotos(target,restoredItem.id,reordered);
    await removeItemPhoto(target,restoredItem.id,restoredItem.primaryMediaId!);
    expect((await getPrimaryPhoto(target,restoredItem.id))?.id).toBe(reordered[1]);
    expect((await getCollection(target,restoredCover.id))?.coverMediaId).toBe(reordered[1]);
    await removeItemPhoto(target,restoredItem.id,reordered[1]!);
    expect((await getCollection(target,restoredCover.id))?.coverType).toBe("default");
  }
  expect(identities[0]!.some(id=>identities[1]!.includes(id))).toBe(false);
  expect(readInventoryArchive(await createInventoryArchive(inventory,{client,directory})).inventory).toEqual(original.inventory);
},30_000);
