import { beforeAll, describe, expect, it } from "vitest";
import { createClient } from "@libsql/client";
import { copyFile, mkdtemp, mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { applyMigrations } from "@/db/migrate";
import { createItem, deleteItem, getItem, listItems, saveStock, updateItem, itemFields } from "./service";

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
    expect(names.rows.map((row) => row.name)).toEqual(["0001_foundation", "0002_inventory_management"]);
  });
});
