import { beforeAll, describe, expect, it } from "vitest";
import { createClient } from "@libsql/client";
import { access, copyFile, mkdtemp, mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import sharp from "sharp";
import { applyMigrations } from "@/db/migrate";
import { createItem, deleteItem, getItem, listItems, saveStock, updateItem, itemFields, photoFirstItemValues } from "./service";
import { createItemWithPhoto, deleteItemWithMedia, getNormalizedPhotoForAnalysis, getPrimaryPhoto, MAX_IMAGE_BYTES, readPrimaryPhoto, removePrimaryPhoto, replacePrimaryPhoto } from "@/media/service";

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

    await updateItem(first.id, { name: "Резисторы", model: "R-1", brand: "Мастер", category: "Электроника", originalMarking: "A1", notes: "верхняя полка", description: "", identificationStatus: "user_confirmed", trackingMode: "bulk", saleIntent: "willing_to_sell", askingPrice: "12.50", askingCurrency: "EUR" });
    await saveStock(first.id, [{ location: "Шкаф A", quantity: 4 }, { location: "Ящик 2", quantity: 6 }]);
    const updated = await getItem(first.id);
    expect(updated).toMatchObject({ name: "Резисторы", inventory_number: "INV-000002", quantity: 10, sale_intent: "willing_to_sell", asking_price_minor: 1250, asking_currency: "EUR" });
    expect(updated?.stock).toHaveLength(2);
    expect((await listItems({ search: "A1" })).map((item) => item.id)).toContain(first.id);
    expect((await listItems({ search: "Мастер" })).map((item) => item.id)).toContain(first.id);
    expect((await listItems({ status: "user_confirmed" })).map((item) => item.id)).toContain(first.id);
    expect((await listItems({ search: "Резисторы" }))[0]).not.toHaveProperty("sale_intent");
    await expect(saveStock(second.id, [{ location: "Полка", quantity: -1 }])).rejects.toThrow();
    await expect(saveStock(second.id, [{ location: "Полка", quantity: 2 }])).rejects.toThrow("уникальной");
    await deleteItem(first.id);
    expect(await getItem(first.id)).toBeNull();
    expect((await listItems()).map((item) => item.id)).not.toContain(first.id);
  });

  it("allocates distinct sequential inventory numbers during concurrent creates", async () => {
    const created = await Promise.all(Array.from({ length: 8 }, (_, index) => createItem({ name: `Concurrent ${index}`, trackingMode: "bulk" })));
    const numbers = created.map((item) => item.inventoryNumber);
    expect(new Set(numbers).size).toBe(8);
    expect(numbers.map((value) => Number(value.slice(4))).sort((a,b) => a-b)).toEqual([4,5,6,7,8,9,10,11]);
  });

  it("applies migrations repeatedly without duplicating schema", async () => {
    await applyMigrations(client, migrations);
    const names = await client.execute("SELECT name FROM _all_items_migrations ORDER BY name");
    expect(names.rows.map((row) => row.name)).toEqual(["0001_foundation", "0002_inventory_management", "0003_private_media"]);
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
    const fullMetadata = await sharp(full!).metadata();
    const thumbnailMetadata = await sharp(thumbnail!).metadata();
    expect(fullMetadata.format).toBe("webp");
    expect(fullMetadata.exif).toBeUndefined();
    expect(fullMetadata.width).toBeLessThanOrEqual(2400);
    expect(thumbnailMetadata.width).toBeLessThanOrEqual(480);
    expect((await getNormalizedPhotoForAnalysis(created.id))?.mimeType).toBe("image/webp");
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
    await expect(replacePrimaryPhoto(created.id, oversized)).rejects.toThrow("не более 10 МБ");
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
    await deleteItemWithMedia(withPhoto.id);
    expect(await getItem(withPhoto.id)).toBeNull();
    await expect(access(attachedFile)).rejects.toThrow();
  });
});
