import { z } from "zod";

// These records stay in this browser's IndexedDB; they are never part of an archive.
const databaseName = "all-items-drafts";
const storeName = "drafts";
const lifetime = 30 * 24 * 60 * 60 * 1000;
const maxDrafts = 20;
const maxPhotoBytes = 10 * 1024 * 1024;
const maxStoredPhotoBytes = 128 * 1024 * 1024;

const fieldsSchema = z.object({
  name: z.string().max(160), model: z.string().max(160), brand: z.string().max(120),
  categories: z.array(z.string().max(80)).max(20), trackingMode: z.enum(["unique", "bulk", "consumable"]),
  originalMarking: z.string().max(160), description: z.string().max(4000), notes: z.string().max(2000),
  identificationStatus: z.enum(["unknown", "user_confirmed", "source_verified"]),
  saleIntent: z.enum(["not_for_sale", "considering", "willing_to_sell"]),
  askingPrice: z.string().max(40), askingCurrency: z.string().max(80),
});
const blobSchema = z.object({
  data: z.instanceof(Blob).refine(value => value.size > 0 && value.size <= maxPhotoBytes && ["image/jpeg", "image/png", "image/webp"].includes(value.type)),
  name: z.string().max(255), lastModified: z.number().finite(),
});
const cropSchema = z.object({ x: z.number().finite(), y: z.number().finite(), width: z.number().finite(), height: z.number().finite(), rotate: z.number().finite(), scaleX: z.number().finite(), scaleY: z.number().finite() });
const draftSchema = z.object({
  version: z.literal(1), key: z.string().max(100), revision: z.string().uuid(), updatedAt: z.number().finite(),
  fields: fieldsSchema, rows: z.array(z.object({ location: z.string().max(120), quantity: z.string().max(7) })).min(1).max(50),
  categoryPresentation: z.array(z.object({ category: z.string().min(1).max(80), emoji: z.string().max(32) })).max(20).default([]),
  photo: z.object({ selected: blobSchema.nullable(), source: blobSchema.nullable(), pending: blobSchema.nullable(), crop: cropSchema.nullable() }).nullable(),
});

export type DraftFields = z.infer<typeof fieldsSchema>;
export type DraftRecord = z.infer<typeof draftSchema>;
export class DraftConflict extends Error {}
export class DraftCapacity extends Error {}

export function fileToDraft(file: File) { return { data: file, name: file.name.slice(0, 255), lastModified: file.lastModified }; }
export function draftToFile(value: z.infer<typeof blobSchema>) {
  return new File([value.data], value.name, { type: value.data.type, lastModified: value.lastModified });
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, 1);
    request.onupgradeneeded = () => { request.result.createObjectStore(storeName, { keyPath: "key" }); };
    request.onerror = () => reject(request.error ?? new Error("Draft storage unavailable"));
    request.onblocked = () => reject(new Error("Draft storage blocked"));
    request.onsuccess = () => { const database = request.result; database.onversionchange = () => database.close(); resolve(database); };
  });
}

export async function readDraft(key: string): Promise<DraftRecord | null> {
  const database = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const transaction = database.transaction(storeName, "readonly");
      const request = transaction.objectStore(storeName).get(key);
      transaction.onerror = () => reject(transaction.error ?? new Error("Draft read failed"));
      request.onsuccess = () => {
        if (request.result === undefined) { resolve(null); return; }
        const result = draftSchema.safeParse(request.result);
        if (!result.success || result.data.key !== key) { reject(new Error("Draft data is invalid")); return; }
        resolve(Date.now() - result.data.updatedAt > lifetime ? null : result.data);
      };
    });
  } finally { database.close(); }
}

// Compare and mutate within one read-write transaction, including across tabs.
export async function writeDraft(record: DraftRecord | null, key: string, expectedRevision: string | null): Promise<void> {
  if (record) draftSchema.parse(record);
  const database = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(storeName, "readwrite");
      const store = transaction.objectStore(storeName);
      let failure: Error | null = null;
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(failure ?? transaction.error ?? new Error("Draft write failed"));
      transaction.onabort = () => reject(failure ?? transaction.error ?? new Error("Draft write failed"));
      const all = store.getAll();
      all.onsuccess = () => {
        try {
        const now = Date.now();
        let current: DraftRecord | null = null;
        let count = 0;
        let totalBytes = 0;
        for (const raw of all.result as unknown[]) {
          const parsed = draftSchema.safeParse(raw);
          if (!parsed.success) { failure = new Error("Draft data is invalid"); transaction.abort(); return; }
          const entry = parsed.data;
          if (now - entry.updatedAt > lifetime) { store.delete(entry.key); continue; }
          count++;
          if (entry.key === key) current = entry;
          else if (entry.photo) totalBytes += (entry.photo.selected?.data.size ?? 0) + (entry.photo.source?.data.size ?? 0) + (entry.photo.pending?.data.size ?? 0);
        }
        if ((current?.revision ?? null) !== expectedRevision) { failure = new DraftConflict("Draft changed in another tab"); transaction.abort(); return; }
        if (record && !current && count >= maxDrafts) { failure = new DraftCapacity("Draft storage is full"); transaction.abort(); return; }
        if (record?.photo) totalBytes += (record.photo.selected?.data.size ?? 0) + (record.photo.source?.data.size ?? 0) + (record.photo.pending?.data.size ?? 0);
        if (record && totalBytes > maxStoredPhotoBytes) { failure = new DraftCapacity("Draft storage is full"); transaction.abort(); return; }
        if (record) store.put(record); else if (current) store.delete(key);
        } catch (error) { failure = error instanceof Error ? error : new Error("Draft write failed"); transaction.abort(); }
      };
    });
  } finally { database.close(); }
}
