import { describe, expect, it } from "vitest";
import { unzipSync, zipSync } from "fflate";
import { ArchiveError, buildInventoryArchive, formatInventoryCsv, verifyInventoryArchive } from "./archive";

describe("portable inventory archive", () => {
  it("builds and verifies an empty valid archive", () => {
    const result = verifyInventoryArchive(buildInventoryArchive({ workspace: null, locations: [], items: [], collections: [], memberships: [], preferences: null }));
    expect(result).toMatchObject({ valid: true, version: 1, entryCount: 3 });
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
      items: [{ id: itemId, inventory_number: "IT-1", category: "Garden tools", sale_intent: "willing_to_sell", stock: [{ id: "stock-a", location_id: "77777777-7777-4777-8777-777777777777", quantity: 2 }, { id: "stock-b", location_id: "88888888-8888-4888-8888-888888888888", quantity: 1 }], collectionIds: [collectionId, secondCollectionId], mediaAssets: [
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
    manifest.version = 2;
    unsupported["manifest.json"] = Buffer.from(JSON.stringify(manifest));
    expect(() => verifyInventoryArchive(zipSync(unsupported))).toThrow(/unsupported version/);
    expect(() => buildInventoryArchive({ items: [], collections: [] }, { "media/../outside": new Uint8Array([1]) })).toThrow(ArchiveError);
    expect(() => verifyInventoryArchive(buildInventoryArchive({ workspace: null, locations: [], items: [{ id: "11111111-1111-4111-8111-111111111111", stock: [], collectionIds: [], mediaAssets: [{ id: "33333333-3333-4333-8333-333333333333", isPrimary: true, imagePath: "media/items/11111111-1111-4111-8111-111111111111/33333333-3333-4333-8333-333333333333.webp", thumbnailPath: "media/items/11111111-1111-4111-8111-111111111111/33333333-3333-4333-8333-333333333333-thumb.webp", sourcePath: null }] }], collections: [], memberships: [] }))).toThrow(/missing or unsafe media/);
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
