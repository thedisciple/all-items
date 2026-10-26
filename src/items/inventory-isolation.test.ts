import { afterAll, beforeAll, expect, it } from "vitest";
import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import sharp from "sharp";
import { getDatabase } from "@/db/client";
import { applyMigrations } from "@/db/migrate";
import { createInventory, inventoryCounts, renameInventory, resolveInventory, type Inventory } from "./inventories";
import { inventoryReturnPath } from "./inventory-context";
import { countItems, createItem, deleteItem, getItem, listCategoryValues, listItems, saveStock, updateItem } from "./service";
import { addItemsToCollection, addItemToCollection, createCollection, deleteCollection, getCollection, listCollections, listCollectionCoverOptions, listItemCollections, removeItemFromCollection, renameCollection, setCollectionCover } from "./collections";
import { createItemWithPhoto, deleteItemWithMedia, getNormalizedPhotoForAnalysis, getPrimaryPhoto, readPrimaryPhoto, removeAssetFiles, removePrimaryPhoto, replacePrimaryPhoto } from "@/media/service";
import { readCollectionCover, removeCollectionCoverAssetFiles, replaceCollectionCoverUpload } from "@/media/collection-covers";
import { createInventoryArchive, createInventoryCsv, readInventoryArchive } from "@/export/archive";
import { deleteInventory, recoverInventoryDeletions } from "./inventory-deletion";
import { normalizedInventoryName } from "./inventory-names";

let home: Inventory, workshop: Inventory;
let homeItems: string[], workshopItems: string[], homeCollection: string, workshopCollection: string, workshopMedia: string, workshopCover: string;
let directory: string;
let image: File;

beforeAll(async () => {
  directory = await mkdtemp(path.join(os.tmpdir(),"all-items-isolation-"));
  process.env.ALL_ITEMS_DATA_DIR=directory;
  const db=await getDatabase();
  await applyMigrations(db.$client,path.join(process.cwd(),"src/db/migrations"));
  home=await createInventory("Home"); workshop=await createInventory("Workshop");
  image=new File([new Uint8Array(await sharp({create:{width:64,height:48,channels:3,background:"#556b7d"}}).png().toBuffer())],"synthetic.png",{type:"image/png"});
  homeItems=[]; workshopItems=[];
  for (const [context,ids,count] of [[home,homeItems,3],[workshop,workshopItems,4]] as const) for(let i=0;i<count;i++) {
    const item=await createItemWithPhoto(context,{name:`${context.name} item ${i}`,categories:[i===0?"tools":`${context.name} custom`],trackingMode:"bulk"},image,image,"",[{location:`${context.name} shelf ${i%2}`,quantity:i+1}]); ids.push(item.id);
  }
  homeCollection=(await createCollection(home,{name:"Home collection"})).id;
  await createCollection(home,{name:"Home other"});
  workshopCollection=(await createCollection(workshop,{name:"Workshop collection"})).id;
  await addItemsToCollection(home,homeCollection,homeItems);
  await addItemsToCollection(workshop,workshopCollection,workshopItems);
  workshopMedia=(await getPrimaryPhoto(workshop,workshopItems[0]!))!.id;
  workshopCover=await replaceCollectionCoverUpload(workshop,workshopCollection,image);
},30_000);
afterAll(async()=>{await (await getDatabase()).$client.close();});

async function rows() {
  const client=(await getDatabase()).$client;
  const snapshot:Record<string,unknown>={};
  for(const table of ["workspaces","items","item_categories","locations","stock_entries","collections","item_collection_memberships","media_assets","collection_cover_assets"]) snapshot[table]=(await client.execute(`SELECT * FROM ${table} ORDER BY ${table==="item_categories"?"item_id,category":"id"}`)).rows;
  return JSON.stringify(snapshot);
}

it("isolates counts, search, categories, stock and numbering; deleting a number leaves a permanent gap",async()=>{
  expect(await inventoryCounts(home)).toEqual({items:3,collections:2});
  expect(await inventoryCounts(workshop)).toEqual({items:4,collections:1});
  expect(await countItems(home)).toBe(3);
  expect((await getItem(home,homeItems[0]!))!.inventory_number).toBe("INV-000001");
  expect((await getItem(workshop,workshopItems[0]!))!.inventory_number).toBe("INV-000001");
  expect(homeItems[0]).not.toBe(workshopItems[0]);
  expect(await listItems(home,{search:"Workshop"})).toEqual([]);
  expect(await listCategoryValues(home)).not.toContain("Workshop custom");
  expect((await listItems(home,{category:"tools"})).map(row=>row.id)).toEqual([homeItems[0]]);
  const discarded=await createItem(home,{name:"Deleted number"});
  await deleteItem(home,discarded.id);
  const next=await createItem(home,{name:"After gap"});
  expect(next.inventoryNumber).toBe("INV-000005");
  await deleteItem(home,next.id);
  expect((await resolveInventory(home.workspaceId)).nextInventoryNumber).toBe(6);
  await renameInventory(home,"Home renamed");
  expect((await resolveInventory(home.workspaceId)).name).toBe("Home renamed");
  expect((await getItem(home,homeItems[0]!))!.stock).toEqual([{location:"Home shelf 0",quantity:1}]);
  expect(await listItemCollections(home,workshopItems[0]!)).toEqual([]);
});

it("rejects foreign identifiers across reads, mutations, media, covers and cleanup without changing records or bytes",async()=>{
  const before=await rows();
  const photo=await readPrimaryPhoto(workshop,workshopItems[0]!,workshopMedia,"image");
  const cover=await readCollectionCover(workshop,workshopCollection,workshopCover,false);
  expect(await getItem(home,workshopItems[0]!)).toBeNull();
  expect(await getCollection(home,workshopCollection)).toBeNull();
  expect(await listCollectionCoverOptions(home,workshopCollection)).toEqual([]);
  expect(await listItems(home,{collectionId:workshopCollection})).toEqual([]);
  expect(await listCategoryValues(home,workshopCollection)).toEqual([]);
  await expect(updateItem(home,workshopItems[0]!,{name:"Cross edit"})).rejects.toThrow();
  await expect(saveStock(home,workshopItems[0]!,[{location:"Home shelf 0",quantity:99}])).rejects.toThrow();
  await deleteItem(home,workshopItems[0]!); await deleteItemWithMedia(home,workshopItems[0]!);
  expect(await removePrimaryPhoto(home,workshopItems[0]!)).toBe(false);
  await expect(replacePrimaryPhoto(home,workshopItems[0]!,image)).rejects.toThrow();
  expect(await getPrimaryPhoto(home,workshopItems[0]!)).toBeNull();
  expect(await readPrimaryPhoto(home,workshopItems[0]!,workshopMedia,"source")).toBeNull();
  expect(await getNormalizedPhotoForAnalysis(home,workshopItems[0]!)).toBeNull();
  expect(await deleteCollection(home,workshopCollection)).toBe(false);
  await expect(renameCollection(home,workshopCollection,{name:"Cross collection"})).rejects.toThrow();
  await expect(addItemToCollection(home,homeCollection,workshopItems[0]!)).rejects.toThrow();
  await expect(addItemsToCollection(home,homeCollection,[homeItems[0]!,workshopItems[0]!])).rejects.toThrow();
  expect(await removeItemFromCollection(home,workshopCollection,workshopItems[0]!)).toBe(false);
  await expect(setCollectionCover(home,homeCollection,{type:"item_photo",itemId:workshopItems[0],mediaId:workshopMedia})).rejects.toThrow();
  await expect(setCollectionCover(home,workshopCollection,{type:"default"})).rejects.toThrow();
  await expect(replaceCollectionCoverUpload(home,workshopCollection,image)).rejects.toThrow();
  expect(await readCollectionCover(home,workshopCollection,workshopCover)).toBeNull();
  const client=(await getDatabase()).$client;
  const asset=(await client.execute({sql:"SELECT * FROM media_assets WHERE id=?",args:[workshopMedia]})).rows[0]!;
  await expect(removeAssetFiles(home,asset as unknown as Parameters<typeof removeAssetFiles>[1])).rejects.toThrow();
  const coverAsset=(await client.execute({sql:"SELECT * FROM collection_cover_assets WHERE id=?",args:[workshopCover]})).rows[0]!;
  await expect(removeCollectionCoverAssetFiles(home,coverAsset as unknown as Parameters<typeof removeCollectionCoverAssetFiles>[1])).rejects.toThrow();
  expect(await rows()).toBe(before);
  expect(await readPrimaryPhoto(workshop,workshopItems[0]!,workshopMedia,"image")).toEqual(photo);
  expect(await readCollectionCover(workshop,workshopCollection,workshopCover,false)).toEqual(cover);
},20_000);

it("preserves legacy duplicate names and prevents new normalized duplicates in concurrent writes",async()=>{
  const client=(await getDatabase()).$client;
  const first=crypto.randomUUID(),second=crypto.randomUUID(),now=new Date().toISOString();
  for(const [id,name] of [[first,"Existing duplicate"],[second,"EXISTING DUPLICATE"]]) await client.execute({sql:"INSERT INTO workspaces(id,name,created_at,next_inventory_number) VALUES(?,?,?,1)",args:[id!,name!,now]});
  await expect(createInventory(" existing DUPLICATE ")).rejects.toThrow("Inventory name already exists");
  const original=await client.execute({sql:"SELECT id,name FROM workspaces WHERE id IN (?,?) ORDER BY id",args:[first,second]});
  expect(original.rows).toHaveLength(2);
  await renameInventory({workspaceId:second},"Distinct renamed inventory");
  expect((await client.execute({sql:"SELECT name FROM workspaces WHERE id=?",args:[first]})).rows[0]!.name).toBe("Existing duplicate");
  const attempts=await Promise.allSettled([createInventory("Concurrent name"),createInventory(" concurrent NAME ")]);
  expect(attempts.filter(result=>result.status==="fulfilled")).toHaveLength(1);
  const rows=(await client.execute("SELECT name FROM workspaces")).rows;
  expect(rows.filter(row=>normalizedInventoryName(String(row.name))==="concurrent name")).toHaveLength(1);
},20_000);

it("deletes only the confirmed inventory after a verified backup and recovers interrupted cleanup",async()=>{
  const client=(await getDatabase()).$client;
  const before=await rows();
  const target=await createInventory("Delete synthetic");
  const item=await createItemWithPhoto(target,{name:"Disposable",categories:["tools"],trackingMode:"bulk"},image,image,"",[{location:"Shelf",quantity:3}]);
  const collection=await createCollection(target,{name:"Disposable collection"});
  await addItemsToCollection(target,collection.id,[item.id]);
  const coverId=await replaceCollectionCoverUpload(target,collection.id,image);
  const photo=(await getPrimaryPhoto(target,item.id))!;
  const photoPath=path.join(directory,"media/items",`${item.id}/${photo.id}.webp`);
  const coverPath=path.join(directory,"media/collections",collection.id,`${coverId}.webp`);
  const populated=await rows();
  await expect(deleteInventory(target,"wrong",{client,directory})).rejects.toThrow("confirmation");
  expect(await rows()).toBe(populated);
  await expect(deleteInventory(target,target.name,{client,directory},"transaction")).rejects.toThrow("Simulated");
  expect(await rows()).toBe(populated);
  expect((await readFile(photoPath)).length).toBeGreaterThan(0);
  const result=await deleteInventory(target,target.name,{client,directory},"cleanup");
  expect(result.cleanupPending).toBe(true);
  const hashes=JSON.parse(await readFile(path.join(result.backup,"verified-sha256.json"),"utf8"));
  expect(hashes["all-items.db"]).toMatch(/^[a-f0-9]{64}$/);
  expect(createHash("sha256").update(await readFile(photoPath)).digest("hex")).toBe(hashes[`media/items/${item.id}/${photo.id}.webp`]);
  expect(await rows()).toBe(before);
  await recoverInventoryDeletions(client,directory);
  await expect(readFile(photoPath)).rejects.toThrow();
  await expect(readFile(coverPath)).rejects.toThrow();
  expect(await rows()).toBe(before);
  expect((await readPrimaryPhoto(workshop,workshopItems[0]!,workshopMedia,"source"))!.length).toBeGreaterThan(0);
  expect((await readCollectionCover(workshop,workshopCollection,workshopCover))!.length).toBeGreaterThan(0);
  expect((await client.execute("PRAGMA foreign_key_check")).rows).toEqual([]);
  expect((await client.execute("PRAGMA integrity_check")).rows[0]!.integrity_check).toBe("ok");
},30_000);

it("allows explicit empty inventory deletion without recreating it",async()=>{
  const target=await createInventory("Empty to delete");
  const result=await deleteInventory(target,"");
  expect(result.cleanupPending).toBe(false);
  await expect(resolveInventory(target.workspaceId)).rejects.toThrow();
  await recoverInventoryDeletions((await getDatabase()).$client,directory);
  await expect(resolveInventory(target.workspaceId)).rejects.toThrow();
},20_000);

it("enforces ownership and immutable numbering in SQLite, including intentional direct-SQL cross references",async()=>{
  const c=(await getDatabase()).$client;
  const location=(await c.execute({sql:"SELECT id FROM locations WHERE workspace_id=? LIMIT 1",args:[workshop.workspaceId]})).rows[0]!.id!;
  const stock=(await c.execute({sql:"SELECT id FROM stock_entries WHERE item_id=?",args:[homeItems[0]!]})).rows[0]!.id!;
  const before=await rows();
  for(const [sql,args] of [
    ["UPDATE stock_entries SET location_id=? WHERE id=?",[location,stock]],
    ["UPDATE items SET workspace_id=? WHERE id=?",[workshop.workspaceId,homeItems[0]!]],
    ["UPDATE items SET inventory_number='INV-000099' WHERE id=?",[homeItems[0]!]],
    ["UPDATE locations SET workspace_id=? WHERE id=?",[home.workspaceId,location]],
    ["UPDATE collections SET workspace_id=? WHERE id=?",[home.workspaceId,workshopCollection]],
    ["UPDATE media_assets SET item_id=? WHERE id=?",[homeItems[0]!,workshopMedia]],
    ["UPDATE collection_cover_assets SET collection_id=? WHERE id=?",[homeCollection,workshopCover]],
    ["UPDATE collections SET cover_type='item_photo',cover_item_id=?,cover_media_id=? WHERE id=?",[workshopItems[0]!,workshopMedia,homeCollection]],
    ["UPDATE collections SET cover_type='upload',cover_upload_id=? WHERE id=?",[workshopCover,homeCollection]],
    ["UPDATE workspaces SET next_inventory_number=1 WHERE id=?",[home.workspaceId]],
    ["INSERT INTO stock_entries(id,item_id,location_id,quantity,created_at,updated_at) VALUES('test',?,?,1,'now','now')",[homeItems[0]!,location]],
    ["INSERT INTO item_collection_memberships(id,item_id,collection_id,created_at) VALUES('test',?,?,'now')",[homeItems[0]!,workshopCollection]],
  ] as const) await expect(c.execute({sql,args:[...args]})).rejects.toThrow();
  expect(await rows()).toBe(before);
  expect((await c.execute("PRAGMA foreign_key_check")).rows).toEqual([]);
  expect((await c.execute("PRAGMA integrity_check")).rows[0]!.integrity_check).toBe("ok");
});

it("exports only the chosen inventory with generated media paths and rejects cross-inventory return routes",async()=>{
  const before=await rows();
  for(const [context,other,ids] of [[home,workshop,homeItems],[workshop,home,workshopItems]] as const) {
    const archive=readInventoryArchive(await createInventoryArchive(context));
    expect((archive.inventory.workspace as {id:string}).id).toBe(context.workspaceId);
    expect((archive.inventory.items as {id:string}[]).map(item=>item.id).sort()).toEqual([...ids].sort());
    expect(JSON.stringify(archive.inventory)).not.toContain(other.workspaceId);
    expect((await createInventoryCsv(context)).toString("utf8")).not.toContain(other.name);
    for(const file of Object.keys(archive.files).filter(file=>file.endsWith(".webp"))) expect(createHash("sha256").update(archive.files[file]!).digest("hex")).toMatch(/^[a-f0-9]{64}$/);
  }
  expect(await rows()).toBe(before);
  expect(()=>inventoryReturnPath(home,`/inventories/${workshop.workspaceId}`)).toThrow();
  expect(()=>inventoryReturnPath(home,"https://example.com")).toThrow();
  await expect(resolveInventory("not-a-uuid")).rejects.toThrow();
  await expect(resolveInventory("99999999-9999-4999-8999-999999999999")).rejects.toThrow();
  expect((await listCollections(home)).map(collection=>collection.id)).not.toContain(workshopCollection);
  expect((await readFile(path.join(directory,"all-items.db"))).length).toBeGreaterThan(0);
},20_000);
