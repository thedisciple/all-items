import { describe, expect, it } from "vitest";
import { unzipSync, zipSync } from "fflate";
import { ArchiveError, buildInventoryArchive, collectionArchivePaths, formatInventoryCsv, itemArchivePaths, verifyInventoryArchive } from "./archive";

describe("portable inventory archive", () => {
  it("builds and verifies an empty valid archive", () => {
    const result = verifyInventoryArchive(buildInventoryArchive({ workspace: null, locations: [], items: [], collections: [], memberships: [], preferences: null }));
    expect(result).toMatchObject({ valid: true, version: 3, entryCount: 4 });
  });

  it("keeps photo arrays, crop information, collection links, and Unicode references portable", () => {
    const itemId = "11111111-1111-4111-8111-111111111111";
    const uploadedCoverId = "44444444-4444-4444-8444-444444444444";
    const collectionId = "22222222-2222-4222-8222-222222222222";
    const photoId = "33333333-3333-4333-8333-333333333333";
    const editablePhotoId = "55555555-5555-4555-8555-555555555555";
    const secondCollectionId = "66666666-6666-4666-8666-666666666666";
    const inventory = {
      workspace: { name: "我的收藏", next_inventory_number: 3 },
      locations: [{ id: "77777777-7777-4777-8777-777777777777", name: "Shelf A" }, { id: "88888888-8888-4888-8888-888888888888", name: "库房" }],
      items: [{ id: itemId, name: "Смарт-годинник", inventory_number: "IT-1", category: "Garden tools", sale_intent: "willing_to_sell", stock: [{ id: "stock-a", location_id: "77777777-7777-4777-8777-777777777777", quantity: 2 }, { id: "stock-b", location_id: "88888888-8888-4888-8888-888888888888", quantity: 1 }], collectionIds: [collectionId, secondCollectionId], mediaAssets: [
        { id: photoId, isPrimary: true, displayOrder: null, cropData: "{\"rotation\":90}", imagePath: `media/items/${itemId}/${photoId}.webp`, thumbnailPath: `media/items/${itemId}/${photoId}-thumb.webp`, sourcePath: null },
        { id: editablePhotoId, isPrimary: false, displayOrder: 1, cropData: null, imagePath: `media/items/${itemId}/${editablePhotoId}.webp`, thumbnailPath: `media/items/${itemId}/${editablePhotoId}-thumb.webp`, sourcePath: `media/items/${itemId}/${editablePhotoId}-source.webp` },
      ] }],
      collections: [
        { id: collectionId, name: "Bašta / сад", cover_type: "upload", cover_upload_id: uploadedCoverId, itemIds: [itemId], uploadCover: { id: uploadedCoverId, path: `media/collections/${collectionId}/${uploadedCoverId}.webp`, thumbnailPath: `media/collections/${collectionId}/${uploadedCoverId}-thumb.webp` } },
        { id: secondCollectionId, name: "工具和植物", icon: "🌿", cover_type: "item_photo", cover_item_id: itemId, cover_media_id: photoId, itemIds: [itemId], uploadCover: null },
      ],
      memberships: [{ item_id: itemId, collection_id: collectionId }, { item_id: itemId, collection_id: secondCollectionId }],
    };
    const archive = buildInventoryArchive(inventory, {
      [`media/items/${itemId}/${photoId}.webp`]: new Uint8Array([1]), [`media/items/${itemId}/${photoId}-thumb.webp`]: new Uint8Array([2]),
      [`media/items/${itemId}/${editablePhotoId}.webp`]: new Uint8Array([3]), [`media/items/${itemId}/${editablePhotoId}-thumb.webp`]: new Uint8Array([4]), [`media/items/${itemId}/${editablePhotoId}-source.webp`]: new Uint8Array([5]),
      [`media/collections/${collectionId}/${uploadedCoverId}.webp`]: new Uint8Array([6]), [`media/collections/${collectionId}/${uploadedCoverId}-thumb.webp`]: new Uint8Array([7]),
    });
    expect(verifyInventoryArchive(archive).valid).toBe(true);
    const files = unzipSync(archive);
    expect(Object.keys(files)).toContain("Items/IT-1 - Смарт-годинник/Смарт-годинник - 33333333 - main.webp");
    expect(Object.keys(files)).toContain("Collections/Bašta сад - 22222222/Bašta сад - cover.webp");
    expect(Buffer.from(files["README.txt"]!).toString("utf8")).toContain("Items/");
  });

  it("rejects checksum corruption, malformed references, and unsafe archive paths", () => {
    const valid = buildInventoryArchive({ workspace: null, locations: [], items: [], collections: [], memberships: [] });
    const files = unzipSync(valid);
    const changedInventory = JSON.parse(Buffer.from(files["inventory.json"]!).toString("utf8")) as Record<string, unknown>;
    changedInventory.tampered = true;
    files["inventory.json"] = Buffer.from(JSON.stringify(changedInventory));
    expect(() => verifyInventoryArchive(zipSync(files))).toThrow(/integrity check failed/);
    const missingEntry = unzipSync(valid); delete missingEntry["inventory.json"];
    expect(() => verifyInventoryArchive(zipSync(missingEntry))).toThrow(/invalid number|missing a required entry/);
    const unsupported = unzipSync(valid);
    const manifest = JSON.parse(Buffer.from(unsupported["manifest.json"]!).toString("utf8")) as { version: number };
    manifest.version = 1;
    unsupported["manifest.json"] = Buffer.from(JSON.stringify(manifest));
    expect(() => verifyInventoryArchive(zipSync(unsupported))).toThrow(/Unsupported archive format/);
    expect(() => buildInventoryArchive({ items: [], collections: [] }, { "media/../outside": new Uint8Array([1]) })).toThrow(ArchiveError);
    expect(() => verifyInventoryArchive(buildInventoryArchive({ workspace: null, locations: [], items: [{ id: "11111111-1111-4111-8111-111111111111", inventory_number: "INV-000001", stock: [], collectionIds: [], mediaAssets: [{ id: "33333333-3333-4333-8333-333333333333", isPrimary: true, imagePath: "media/items/11111111-1111-4111-8111-111111111111/33333333-3333-4333-8333-333333333333.webp", thumbnailPath: "media/items/11111111-1111-4111-8111-111111111111/33333333-3333-4333-8333-333333333333-thumb.webp", sourcePath: null }] }], collections: [], memberships: [] }))).toThrow(/missing or unsafe media/);
  });

  it("makes readable, bounded, collision-safe paths from unsafe and Unicode names", () => {
    const item = { id: "11111111-1111-4111-8111-111111111111", inventory_number: "INV-000001", name: "CON:/设备\\時計?" + "🧰".repeat(100) };
    const paths = itemArchivePaths(item, { id: "33333333-3333-4333-8333-333333333333" });
    expect(paths.imagePath).toMatch(/^Items\/INV-000001 - /);
    expect(paths.imagePath).toContain("设备");
    expect(Buffer.byteLength(paths.imagePath, "utf8")).toBeLessThanOrEqual(240);
    expect(paths.imagePath).not.toMatch(/[\\:*?"<>|]/);
    expect(collectionArchivePaths({ id: "22222222-2222-4222-8222-222222222222", name: "con" }).path).toContain("Collection - 22222222");
  });

  it("rejects unsafe, equivalent and oversized ZIP entries before reading metadata", () => {
    const bytes = new Uint8Array([1]);
    for (const name of ["../outside", "/absolute", "C:/absolute", "Items/CON.webp", "Items/trailing. "]) {
      expect(() => verifyInventoryArchive(zipSync({ [name]: bytes }))).toThrow(/unsafe or duplicate path/);
    }
    expect(() => verifyInventoryArchive(zipSync({ "Items/Photo.webp": bytes, "Items/photo.webp": bytes }))).toThrow(/unsafe or duplicate path/);
    expect(() => verifyInventoryArchive(zipSync({ "Items/é.webp": bytes, "Items/e\u0301.webp": bytes }))).toThrow(/unsafe or duplicate path/);
    expect(() => verifyInventoryArchive(zipSync({ "Items/bomb.webp": new Uint8Array(1_000_000) }, { level: 9 }))).toThrow(/unsupported or oversized entry/);
    expect(() => verifyInventoryArchive(zipSync({ "Items/large.webp": new Uint8Array(32 * 1024 * 1024 + 1) }, { level: 0 }))).toThrow(/unsupported or oversized entry/);
  });
});

describe("CSV export", () => {
  it("quotes Unicode, multiline text, embedded quotes, and neutralizes spreadsheet formulas", () => {
    const csv = formatInventoryCsv([{ inventory_number: "001", name: "=1+1", model: null, brand: "Brand, Inc.", category: "工具", quantity: 2, locations: "Shelf\nA", identification_status: "unknown", sale_intent: "not_for_sale", asking_price_minor: null, asking_currency: null, description: 'Said "hello"', notes: "  @SUM(A1:A2)" }]).toString("utf8");
    expect(csv).toContain('"\'=1+1"');
    expect(csv).toContain('"Brand, Inc."');
    expect(csv).toContain('"Shelf\nA"');
    expect(csv).toContain('"Said ""hello"""');
    expect(csv).toContain("工具");
    expect(csv).toContain("\uFEFF");
  });
});
