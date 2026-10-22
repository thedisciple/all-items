import { beforeAll, describe, expect, it } from "vitest";
import { createClient } from "@libsql/client";
import { access, copyFile, mkdtemp, mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import sharp from "sharp";
import { applyMigrations } from "@/db/migrate";
import { addItemToCollection, addItemsToCollection, createCollection, deleteCollection, getCollection, listCollectionCoverOptions, listCollections, listItemCollections, removeItemFromCollection, renameCollection, setCollectionCover } from "@/items/collections";
import { createItem, deleteItem, getItem, listCategoryValues, listItems, saveStock, updateItem, itemFields, photoFirstItemValues } from "./service";
import { createItemWithPhoto, deleteItemWithMedia, getNormalizedPhotoForAnalysis, getPrimaryPhoto, MAX_IMAGE_BYTES, readPrimaryPhoto, removePrimaryPhoto, replacePrimaryPhoto } from "@/media/service";
import { readCollectionCover, replaceCollectionCoverUpload } from "@/media/collection-covers";

const migrations = path.join(process.cwd(), "src/db/migrations");
let directory = "";
let client: ReturnType<typeof createClient>;
beforeAll(async () => {
  directory = await mkdtemp(path.join(os.tmpdir(), "all-items-test-"));
  process.env.ALL_ITEMS_DATA_DIR = directory;
  const dbPath = path.join(directory, "all-items.db");
  client = createClient({ url: pathToFileURL(dbPath).href });
  const legacyMigrations = path.join(directory, "legacy-migrations");
  await mkdir(legacyMigrations);
  await copyFile(path.join(migrations, "0001_foundation.sql"), path.join(legacyMigrations, "0001_foundation.sql"));
  await applyMigrations(client, legacyMigrations);
  const workspaceId = "00000000-0000-4000-8000-000000000001";
  await client.execute({ sql: "INSERT INTO workspaces (id, name, created_at) VALUES (?, ?, ?)", args: [workspaceId, "Test", "2025-01-01T00:00:00.000Z"] });
  await client.execute({ sql: "INSERT INTO items (id, workspace_id, name, model, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)", args: ["00000000-0000-4000-8000-000000000010", workspaceId, "Legacy item", "old model", "2025-01-02T00:00:00.000Z", "2025-01-03T00:00:00.000Z"] });
  await applyMigrations(client, migrations);
});

describe("M1 inventory", () => {
  it("validates item fields and trims user input", () => {
    expect(itemFields.parse({ name: "  Вольтметр  " }).name).toBe("Вольтметр");
    expect(photoFirstItemValues({ name: "", model: " HC-12 " }, true)).toMatchObject({ name: "Неизвестный предмет", model: " HC-12 ", identificationStatus: "unknown" });
    expect(() => itemFields.parse({ name: "  " })).toThrow();
    expect(itemFields.parse({ name: "Тестер", saleIntent: "willing_to_sell" }).saleIntent).toBe("willing_to_sell");
  });

  it("backfills existing rows with stable inventory numbers and stock", async () => {
    const row = await getItem("00000000-0000-4000-8000-000000000010");
    expect(row).toMatchObject({ id: "00000000-0000-4000-8000-000000000010", name: "Legacy item", model: "old model", inventory_number: "INV-000001", quantity: 1 });
    expect(row?.stock).toHaveLength(1);
  });

  it("creates, searches, edits, tracks stock, and deletes items", async () => {
    const first = await createItem({ name: "Радиодеталь", model: "R-1", brand: "Мастер", category: "Электроника", originalMarking: "A1", notes: "верхняя полка", trackingMode: "bulk" });
    const second = await createItem({ name: "Крепёж", trackingMode: "unique" });
    expect(first.inventoryNumber).toBe("INV-000002");
    expect(second.inventoryNumber).toBe("INV-000003");
    expect((await listItems({ search: "верхняя" })).map((item) => item.id)).toContain(first.id);
    expect((await listItems({ category: "Электроника" })).map((item) => item.id)).toContain(first.id);
    expect((await listItems({ search: "INV-000002" })).map((item) => item.id)).toContain(first.id);

    await updateItem(first.id, { name: "Резисторы", model: "R-1", brand: "Мастер", category: "Электроника", originalMarking: "A1", notes: "верхняя полка", description: "", identificationStatus: "user_confirmed", trackingMode: "bulk", saleIntent: "willing_to_sell", askingPrice: "12.50", askingCurrency: "EUR" });
    await saveStock(first.id, [{ location: "Шкаф A", quantity: 4 }, { location: "Ящик 2", quantity: 6 }]);
    const updated = await getItem(first.id);
    expect(updated).toMatchObject({ name: "Резисторы", inventory_number: "INV-000002", quantity: 10, sale_intent: "willing_to_sell", asking_price_minor: 1250, asking_currency: "EUR" });
    expect(updated?.stock).toHaveLength(2);
    expect((await listItems({ search: "A1" })).map((item) => item.id)).toContain(first.id);
    expect((await listItems({ search: "Мастер" })).map((item) => item.id)).toContain(first.id);
    expect((await listItems({ search: "Шкаф A" })).map((item) => item.id)).toContain(first.id);
    expect((await listItems({ status: "user_confirmed" })).map((item) => item.id)).toContain(first.id);
    expect((await listItems({ search: "Резисторы" }))[0]).not.toHaveProperty("sale_intent");
    await expect(saveStock(second.id, [{ location: "Полка", quantity: -1 }])).rejects.toThrow();
    await expect(saveStock(second.id, [{ location: "Полка", quantity: 2 }])).rejects.toThrow("уникальной");
    await deleteItem(first.id);
    expect(await getItem(first.id)).toBeNull();
    expect((await listItems()).map((item) => item.id)).not.toContain(first.id);
  });

  it("matches stable and legacy category values and applies deterministic sort directions", async () => {
    const stable = await createItem({ name: "M2D-R2 Electronics stable", category: "electronics", trackingMode: "bulk" });
    const russianLegacy = await createItem({ name: "M2D-R2 Electronics Russian legacy", category: "Электроника", trackingMode: "bulk" });
    const englishLegacy = await createItem({ name: "M2D-R2 Electronics English legacy", category: "Electronics", trackingMode: "bulk" });
    const custom = await createItem({ name: "M2D-R2 Custom category", category: "Bench components", trackingMode: "bulk" });
    expect((await listItems({ category: "electronics" })).map((row) => row.id)).toEqual(expect.arrayContaining([stable.id, russianLegacy.id, englishLegacy.id]));
    expect((await listItems({ category: "Electronics", search: "English legacy" })).map((row) => row.id)).toContain(englishLegacy.id);
    expect((await listItems({ category: "Bench components" })).map((row) => row.id)).toContain(custom.id);
    expect((await listCategoryValues()).filter((value) => value === "Bench components")).toEqual(["Bench components"]);
    const scoped = await createCollection({ name: "M2D-R2 category scope" });
    await addItemsToCollection(scoped.id, [stable.id, russianLegacy.id, englishLegacy.id, custom.id]);
    expect((await listItems({ collectionId: scoped.id, category: "electronics" })).map((row) => row.id)).toEqual(expect.arrayContaining([stable.id, russianLegacy.id]));
    expect((await listItems({ collectionId: scoped.id, search: "English legacy", category: "electronics" })).map((row) => row.id)).toContain(englishLegacy.id);
    expect(await listCategoryValues(scoped.id)).toEqual(expect.arrayContaining(["Bench components"]));

    const alpha = await createItem({ name: "M2D-R2 sort fixture Alpha", trackingMode: "bulk" });
    const beta = await createItem({ name: "M2D-R2 sort fixture Beta", trackingMode: "bulk" });
    const gamma = await createItem({ name: "M2D-R2 sort fixture Gamma", trackingMode: "bulk" });
    await saveStock(alpha.id, [{ location: "", quantity: 1 }]);
    await saveStock(beta.id, [{ location: "", quantity: 9 }]);
    await saveStock(gamma.id, [{ location: "", quantity: 4 }]);
    await client.execute({ sql: "UPDATE items SET created_at = ? WHERE id = ?", args: ["2020-01-01T00:00:00.000Z", alpha.id] });
    await client.execute({ sql: "UPDATE items SET created_at = ? WHERE id = ?", args: ["2022-01-01T00:00:00.000Z", beta.id] });
    await client.execute({ sql: "UPDATE items SET created_at = ? WHERE id = ?", args: ["2021-01-01T00:00:00.000Z", gamma.id] });
    expect((await listItems({ search: "M2D-R2 sort fixture", sort: "name" })).map((row) => row.name)).toEqual([
      "M2D-R2 sort fixture Alpha", "M2D-R2 sort fixture Beta", "M2D-R2 sort fixture Gamma",
    ]);
    expect((await listItems({ search: "M2D-R2 sort fixture", sort: "quantity" })).map((row) => row.name)).toEqual([
      "M2D-R2 sort fixture Beta", "M2D-R2 sort fixture Gamma", "M2D-R2 sort fixture Alpha",
    ]);
    expect((await listItems({ search: "M2D-R2 sort fixture", sort: "date" })).map((row) => row.name)).toEqual([
      "M2D-R2 sort fixture Beta", "M2D-R2 sort fixture Gamma", "M2D-R2 sort fixture Alpha",
    ]);
  });

  it("allocates distinct sequential inventory numbers during concurrent creates", async () => {
    const created = await Promise.all(Array.from({ length: 8 }, (_, index) => createItem({ name: `Concurrent ${index}`, trackingMode: "bulk" })));
    const numbers = created.map((item) => item.inventoryNumber);
    expect(new Set(numbers).size).toBe(8);
    const sequence = numbers.map((value) => Number(value.slice(4))).sort((a,b) => a-b);
    expect(sequence.slice(1).map((value, index) => value - sequence[index])).toEqual(Array(7).fill(1));
  });

  it("applies migrations repeatedly without duplicating schema", async () => {
    await applyMigrations(client, migrations);
    const names = await client.execute("SELECT name FROM _all_items_migrations ORDER BY name");
    expect(names.rows.map((row) => row.name)).toEqual(["0001_foundation", "0002_inventory_management", "0003_private_media", "0004_collections", "0005_editable_media_source", "0006_collection_covers"]);
  });
});

describe("collections", () => {
  it("adds multiple existing items transactionally and keeps collection covers explicit", async () => {
    const image = await sharp({ create: { width: 80, height: 60, channels: 3, background: "#325577" } }).jpeg().toBuffer();
    const first = await createItemWithPhoto({ name: "Batch camera" }, new File([new Uint8Array(image)], "camera.jpg", { type: "image/jpeg" }));
    const second = await createItem({ name: "Batch tool" });
    const collection = await createCollection({ name: "Batch collection", icon: "🤖" });
    await expect(addItemsToCollection(collection.id, [first.id, second.id, first.id])).rejects.toThrow();
    expect((await listItemCollections(first.id))).toHaveLength(0);
    expect(await addItemsToCollection(collection.id, [first.id, second.id])).toEqual({ added: 2 });
    expect(await addItemsToCollection(collection.id, [first.id, second.id])).toEqual({ added: 0 });
    expect(await listCollectionCoverOptions(collection.id)).toEqual([{ itemId: first.id, name: "Batch camera", model: null, mediaId: (await getPrimaryPhoto(first.id))!.id }]);
    expect((await listCollections()).find((row) => row.id === collection.id)).toMatchObject({ coverType: "emoji", coverIcon: "🤖", coverMediaId: null });

    const photo = await getPrimaryPhoto(first.id);
    await setCollectionCover(collection.id, { type: "item_photo", itemId: first.id, mediaId: photo!.id });
    expect((await listCollections()).find((row) => row.id === collection.id)).toMatchObject({ coverType: "item_photo", coverItemId: first.id, coverMediaId: photo!.id });
    await removePrimaryPhoto(first.id);
    expect((await listCollections()).find((row) => row.id === collection.id)?.coverType).toBe("default");
    await expect(setCollectionCover(collection.id, { type: "item_photo", itemId: second.id, mediaId: photo!.id })).rejects.toThrow();
    await setCollectionCover(collection.id, { type: "emoji", icon: "📷" });
    expect((await getCollection(collection.id))?.coverIcon).toBe("📷");
    await setCollectionCover(collection.id, { type: "default" });
    expect((await getCollection(collection.id))?.coverType).toBe("default");
    expect(await getItem(second.id)).not.toBeNull();
  });

  it("normalizes private collection-cover uploads and cleans replaced and deleted files", async () => {
    const collection = await createCollection({ name: "Uploaded cover collection" });
    const first = await sharp({ create: { width: 180, height: 120, channels: 3, background: "#ca8734" } }).jpeg().withExif({ IFD0: { ImageDescription: "private synthetic cover" } }).toBuffer();
    const second = await sharp({ create: { width: 120, height: 180, channels: 3, background: "#426532" } }).png().toBuffer();
    const coverId = await replaceCollectionCoverUpload(collection.id, new File([new Uint8Array(first)], "cover.jpg", { type: "image/jpeg" }));
    const firstCover = await readCollectionCover(collection.id, coverId, false);
    expect((await sharp(firstCover!).metadata()).exif).toBeUndefined();
    expect((await readCollectionCover(collection.id, coverId))?.byteLength).toBeGreaterThan(0);
    const nextCoverId = await replaceCollectionCoverUpload(collection.id, new File([new Uint8Array(second)], "cover.png", { type: "image/png" }));
    expect(await readCollectionCover(collection.id, coverId)).toBeNull();
    expect((await listCollections()).find((row) => row.id === collection.id)?.coverUploadId).toBe(nextCoverId);
    await setCollectionCover(collection.id, { type: "default" });
    expect(await readCollectionCover(collection.id, nextCoverId)).toBeNull();
    const finalCoverId = await replaceCollectionCoverUpload(collection.id, new File([new Uint8Array(first)], "cover.jpg", { type: "image/jpeg" }));
    expect(await deleteCollection(collection.id)).toBe(true);
    expect(await readCollectionCover(collection.id, finalCoverId)).toBeNull();
  });

  it("returns explicit plain-object detail and collection DTOs for item pages", async () => {
    const image = await sharp({ create: { width: 48, height: 36, channels: 3, background: "#426584" } }).png().toBuffer();
    const item = await createItemWithPhoto({ name: "Serializable detail fixture", trackingMode: "bulk" }, new File([new Uint8Array(image)], "detail.png", { type: "image/png" }));
    await saveStock(item.id, [{ location: "", quantity: 2 }, { location: "Shelf A", quantity: 3 }, { location: "Box 2", quantity: 4 }]);
    const first = await createCollection({ name: "Serializable collection A" });
    const second = await createCollection({ name: "Serializable collection B" });
    await addItemToCollection(first.id, item.id);
    await addItemToCollection(second.id, item.id);
    expect((await listItems({ search: "Shelf A" })).map((row) => row.id)).toContain(item.id);
    expect((await listItems({ search: "Serializable collection A" })).map((row) => row.id)).toContain(item.id);

    const detail = await getItem(item.id);
    const memberships = await listItemCollections(item.id);
    expect(detail).not.toBeNull();
    expect(Object.getPrototypeOf(detail)).toBe(Object.prototype);
    expect(detail).toMatchObject({ id: item.id, quantity: 9, primary_media_id: expect.any(String) });
    expect(detail?.stock).toHaveLength(3);
    expect(detail?.stock.map((row) => row.quantity).sort()).toEqual([2, 3, 4]);
    expect(detail?.stock.find((row) => row.location === null)).toMatchObject({ quantity: 2, location: null });
    expect(detail?.stock.every((row) => Object.getPrototypeOf(row) === Object.prototype)).toBe(true);
    expect(detail?.stock.every((row) => typeof row.quantity === "number" && (row.location === null || typeof row.location === "string"))).toBe(true);
    expect(memberships).toHaveLength(2);
    expect(memberships.every((row) => Object.getPrototypeOf(row) === Object.prototype && typeof row.id === "string" && typeof row.name === "string")).toBe(true);
  });

  it("creates, renames, filters, supports multiple memberships, and deletes without deleting items or photos", async () => {
    const source = await sharp({ create: { width: 48, height: 36, channels: 3, background: "#47652e" } }).jpeg().toBuffer();
    const item = await createItemWithPhoto({ name: "Collection fixture" }, new File([new Uint8Array(source)], "collection.jpg", { type: "image/jpeg" }));
    const first = await createCollection({ name: "  Робототехника  ", icon: "🤖" });
    const second = await createCollection({ name: "Домашняя мастерская" });
    await expect(createCollection({ name: "робототехника" })).rejects.toThrow("уже есть");
    await addItemToCollection(first.id, item.id);
    await addItemToCollection(first.id, item.id);
    await addItemToCollection(second.id, item.id);
    await saveStock(item.id, [{ location: "Studio shelf", quantity: 1 }]);
    expect((await listItems({ search: "Studio shelf" })).map((row) => row.id)).toContain(item.id);
    expect(await listItemCollections(item.id)).toHaveLength(2);
    expect((await listItems({ collectionId: first.id })).map((row) => row.id)).toContain(item.id);
    expect(Number((await listCollections()).find((collection) => collection.id === first.id)?.itemCount)).toBe(1);

    await renameCollection(first.id, { name: "Мои роботы" });
    expect((await getCollection(first.id))?.name).toBe("Мои роботы");
    expect((await getCollection(first.id))?.icon).toBe("🤖");
    await removeItemFromCollection(first.id, item.id);
    expect((await listItemCollections(item.id)).map((collection) => collection.id)).toEqual([second.id]);

    const photo = await getPrimaryPhoto(item.id);
    expect(await deleteCollection(second.id)).toBe(true);
    expect(await getCollection(second.id)).toBeNull();
    expect(await getItem(item.id)).not.toBeNull();
    expect((await listItems()).map((row) => row.id)).toContain(item.id);
    expect((await listItemCollections(item.id))).toHaveLength(0);
    expect((await readPrimaryPhoto(item.id, photo!.id, "image"))?.byteLength).toBeGreaterThan(0);
  });

  it("isolates collection and item membership to the local workspace", async () => {
    const foreignWorkspace = "00000000-0000-4000-8000-000000000099";
    const foreignItem = "00000000-0000-4000-8000-000000000098";
    const foreignCollection = "00000000-0000-4000-8000-000000000097";
    await client.execute({ sql: "INSERT INTO workspaces (id, name, created_at) VALUES (?, ?, ?)", args: [foreignWorkspace, "Other test workspace", "2025-01-01T00:00:00.000Z"] });
    await client.execute({ sql: `INSERT INTO items (id, workspace_id, name, model, inventory_number, identification_status, tracking_mode, sale_intent, created_at, updated_at) VALUES (?, ?, ?, NULL, ?, 'unknown', 'bulk', 'not_for_sale', ?, ?)`, args: [foreignItem, foreignWorkspace, "Other workspace item", "INV-000001", "2025-01-02T00:00:00.000Z", "2025-01-02T00:00:00.000Z"] });
    await client.execute({ sql: "INSERT INTO collections (id, workspace_id, name, normalized_name, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)", args: [foreignCollection, foreignWorkspace, "Other collection", "other collection", "2025-01-01T00:00:00.000Z", "2025-01-01T00:00:00.000Z"] });
    const localItem = await createItem({ name: "Local workspace item", trackingMode: "bulk" });
    const localCollection = await createCollection({ name: "Local collection" });
    await expect(addItemToCollection(localCollection.id, foreignItem)).rejects.toThrow("Вещь не найдена");
    await expect(addItemToCollection(foreignCollection, localItem.id)).rejects.toThrow("Коллекция не найдена");
    await expect(client.execute({ sql: "INSERT INTO item_collection_memberships (id, collection_id, item_id, created_at) VALUES (?, ?, ?, ?)", args: ["00000000-0000-4000-8000-000000000096", localCollection.id, foreignItem, "2025-01-03T00:00:00.000Z"] })).rejects.toThrow("same workspace");
    expect(await getCollection(foreignCollection)).toBeNull();
  });
});

describe("private image storage", () => {
  it("accepts a photo-only item, normalizes orientation and strips EXIF, and makes a thumbnail", async () => {
    const source = await sharp({ create: { width: 800, height: 600, channels: 3, background: { r: 160, g: 80, b: 30 } } })
      .jpeg().withExif({ IFD0: { ImageDescription: "private fixture" }, IFD3: { GPSLatitudeRef: "N", GPSLatitude: "47/1 30/1 0/1" } }).toBuffer();
    const file = new File([new Uint8Array(source)], "C:\\private\\camera.jpg", { type: "image/jpeg" });
    const created = await createItemWithPhoto({ name: "Неизвестный предмет", model: "HC-12", trackingMode: "unique" }, file);
    const item = await getItem(created.id);
    const photo = await getPrimaryPhoto(created.id);
    expect(item).toMatchObject({ name: "Неизвестный предмет", model: "HC-12", identification_status: "unknown" });
    expect(photo).toMatchObject({ width: 800, height: 600 });
    expect(item?.primary_media_id).toBe(photo?.id);

    const full = await readPrimaryPhoto(created.id, photo!.id, "image");
    const thumbnail = await readPrimaryPhoto(created.id, photo!.id, "thumbnail");
    const cleanSource = await readPrimaryPhoto(created.id, photo!.id, "source");
    const fullMetadata = await sharp(full!).metadata();
    const thumbnailMetadata = await sharp(thumbnail!).metadata();
    const sourceMetadata = await sharp(cleanSource!).metadata();
    expect(fullMetadata.format).toBe("webp");
    expect(fullMetadata.exif).toBeUndefined();
    expect(fullMetadata.width).toBeLessThanOrEqual(2400);
    expect(thumbnailMetadata.width).toBeLessThanOrEqual(480);
    expect(sourceMetadata.width).toBe(800);
    expect(sourceMetadata.exif).toBeUndefined();
    expect((await getNormalizedPhotoForAnalysis(created.id))?.mimeType).toBe("image/webp");
  });

  it("keeps a clean source while storing a cropped display derivative and crop data", async () => {
    const sourceBytes = await sharp({ create: { width: 320, height: 240, channels: 3, background: "#315577" } }).jpeg().toBuffer();
    const cropBytes = await sharp({ create: { width: 160, height: 120, channels: 3, background: "#c27030" } }).webp().toBuffer();
    const source = new File([new Uint8Array(sourceBytes)], "source.jpg", { type: "image/jpeg" });
    const display = new File([new Uint8Array(cropBytes)], "crop.webp", { type: "image/webp" });
    const data = JSON.stringify({ x: 40, y: 30, width: 160, height: 120, rotate: 0, scaleX: 1, scaleY: 1 });
    const item = await createItemWithPhoto({ name: "Editable source fixture" }, display, source, data);
    const photo = await getPrimaryPhoto(item.id);
    const storedSource = await readPrimaryPhoto(item.id, photo!.id, "source");
    const storedDisplay = await readPrimaryPhoto(item.id, photo!.id, "image");
    expect((await sharp(storedSource!).metadata()).width).toBe(320);
    expect((await sharp(storedDisplay!).metadata()).width).toBe(160);
    const media = await client.execute({ sql: "SELECT source_storage_path, crop_data FROM media_assets WHERE id = ?", args: [photo!.id] });
    expect(media.rows[0].source_storage_path).toBe(`${item.id}/${photo!.id}-source.webp`);
    expect(JSON.parse(String(media.rows[0].crop_data))).toMatchObject({ x: 40, y: 30, width: 160, height: 120 });
  });

  it("rejects invalid, oversized, oversized-dimension, and path-traversal input without losing the current photo", async () => {
    const source = await sharp({ create: { width: 80, height: 60, channels: 3, background: "#667788" } }).png().toBuffer();
    const created = await createItemWithPhoto({ name: "Fixture with photo" }, new File([new Uint8Array(source)], "photo.png", { type: "image/png" }));
    const current = await getPrimaryPhoto(created.id);
    const invalid = new File(["not an image"], "bad.png", { type: "image/png" });
    const priorItems = await listItems();
    await expect(createItemWithPhoto({ name: "Неизвестный предмет" }, invalid)).rejects.toThrow();
    expect(await listItems()).toHaveLength(priorItems.length);
    await expect(replacePrimaryPhoto(created.id, invalid)).rejects.toThrow("Не удалось прочитать");
    expect((await getPrimaryPhoto(created.id))?.id).toBe(current?.id);
    const oversized = new File([new Uint8Array(MAX_IMAGE_BYTES + 1)], "large.jpg", { type: "image/jpeg" });
    await expect(replacePrimaryPhoto(created.id, oversized)).rejects.toThrow("не более 10 МиБ");
    const wide = await sharp({ create: { width: 12001, height: 1, channels: 3, background: "#000000" } }).png().toBuffer();
    await expect(replacePrimaryPhoto(created.id, new File([new Uint8Array(wide)], "wide.png", { type: "image/png" }))).rejects.toThrow("12 000");
    await expect(readPrimaryPhoto("../../outside", current!.id, "image")).rejects.toThrow();
    await expect(readPrimaryPhoto(created.id, "../../outside", "image")).rejects.toThrow();
    await expect(readPrimaryPhoto(created.id, current!.id, "../../outside")).rejects.toThrow();
  });

  it("replaces and removes a photo, then deletes item media without leaving files", async () => {
    const first = await sharp({ create: { width: 40, height: 30, channels: 3, background: "#335577" } }).jpeg().toBuffer();
    const second = await sharp({ create: { width: 64, height: 48, channels: 4, background: { r: 10, g: 200, b: 90, alpha: 0.5 } } }).png().toBuffer();
    const item = await createItemWithPhoto({ name: "Replace fixture" }, new File([new Uint8Array(first)], "first.jpg", { type: "image/jpeg" }));
    const previous = await getPrimaryPhoto(item.id);
    const directoryPath = path.join(directory, "media", "items", item.id);
    const previousFile = path.join(directoryPath, `${previous!.id}.webp`);
    await replacePrimaryPhoto(item.id, new File([new Uint8Array(second)], "replacement.png", { type: "image/png" }));
    const current = await getPrimaryPhoto(item.id);
    expect(current?.id).not.toBe(previous?.id);
    expect(await readPrimaryPhoto(item.id, previous!.id, "image")).toBeNull();
    await expect(access(previousFile)).rejects.toThrow();
    expect((await sharp((await readPrimaryPhoto(item.id, current!.id, "image"))!).metadata()).hasAlpha).toBe(true);
    expect(await removePrimaryPhoto(item.id)).toBe(true);
    expect(await getPrimaryPhoto(item.id)).toBeNull();
    expect(await removePrimaryPhoto(item.id)).toBe(false);

    const withPhoto = await createItemWithPhoto({ name: "Delete fixture" }, new File([new Uint8Array(first)], "first.jpg", { type: "image/jpeg" }));
    const attached = await getPrimaryPhoto(withPhoto.id);
    const attachedFile = path.join(directory, "media", "items", withPhoto.id, `${attached!.id}.webp`);
    const attachedSourceFile = path.join(directory, "media", "items", withPhoto.id, `${attached!.id}-source.webp`);
    await deleteItemWithMedia(withPhoto.id);
    expect(await getItem(withPhoto.id)).toBeNull();
    await expect(access(attachedFile)).rejects.toThrow();
    await expect(access(attachedSourceFile)).rejects.toThrow();
  });
});
