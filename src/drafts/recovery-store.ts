import { z } from "zod";
import {draftFieldsSchema} from "@/items/draft-fields";
import {MAX_CREATION_PHOTO_BYTES,NEW_ITEM_PHOTO_LIMIT} from "@/media/limits";

// These records stay in this browser's IndexedDB; they are never part of an archive.
const databaseName = "all-items-drafts";
const storeName = "drafts";
const lifetime = 30 * 24 * 60 * 60 * 1000;
const maxDrafts = 20;
const maxPhotoBytes = 10 * 1024 * 1024;
const maxStoredPhotoBytes = 128 * 1024 * 1024;

const fieldsSchema=draftFieldsSchema;
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

const galleryPhotoSchema=z.object({
  id:z.uuid(),selected:blobSchema.nullable(),source:blobSchema.nullable(),pending:blobSchema.nullable(),
  crop:cropSchema.nullable(),pendingCrop:cropSchema.nullable(),
});
const galleryDraftSchema=draftSchema.omit({photo:true,version:true}).extend({
  version:z.literal(2),operationId:z.uuid(),photos:z.array(galleryPhotoSchema).max(NEW_ITEM_PHOTO_LIMIT),
  primaryId:z.uuid().nullable(),selectedId:z.uuid().nullable(),visibleIndex:z.number().int().min(0).max(NEW_ITEM_PHOTO_LIMIT-1),
}).superRefine((record,context)=>{
  const ids=new Set(record.photos.map(photo=>photo.id));
  if(ids.size!==record.photos.length||record.photos.length>0&&(!record.primaryId||!ids.has(record.primaryId)||record.selectedId!==record.photos[record.visibleIndex]?.id)||!record.photos.length&&(record.primaryId!==null||record.selectedId!==null||record.visibleIndex!==0))context.addIssue({code:"custom",message:"Invalid draft gallery references"});
  if(storedPhotoBytes(record)>MAX_CREATION_PHOTO_BYTES)context.addIssue({code:"custom",message:"Draft photo budget exceeded"});
});
const anyDraftSchema=z.union([draftSchema,galleryDraftSchema]);

export type DraftFields = z.infer<typeof fieldsSchema>;
export type DraftRecord = z.infer<typeof draftSchema>;
export type GalleryDraftRecord=z.infer<typeof galleryDraftSchema>;
type AnyDraftRecord=DraftRecord|GalleryDraftRecord;
export class DraftConflict extends Error {}
export class DraftCapacity extends Error {}

export function fileToDraft(file: File) { return { data: file, name: file.name.slice(0, 255), lastModified: file.lastModified }; }
export function draftToFile(value: z.infer<typeof blobSchema>) {
  return new File([value.data], value.name, { type: value.data.type, lastModified: value.lastModified });
}

export function storedPhotoBytes(record:AnyDraftRecord){
  const blobs=new Set<Blob>();
  for(const photo of record.version===1?[record.photo]:record.photos)if(photo)for(const input of [photo.selected,photo.source,photo.pending])if(input)blobs.add(input.data);
  return[...blobs].reduce((total,blob)=>total+blob.size,0);
}

export function upgradeDraft(record:AnyDraftRecord):GalleryDraftRecord{
  if(record.version===2)return record;
  const photos=record.photo&&(record.photo.selected||record.photo.source||record.photo.pending)?[{...record.photo,id:record.revision,pendingCrop:null}]:[];
  // Preserve the committed CAS identity. Reading is not a migration write.
  const {photo:_photo,...fields}=record;void _photo;
  return{...fields,version:2,operationId:record.revision,photos,primaryId:photos[0]?.id??null,selectedId:photos[0]?.id??null,visibleIndex:0};
}

export function galleryDraftFiles(record:GalleryDraftRecord){
  const files=new Map<Blob,File>();
  const restore=(input:z.infer<typeof blobSchema>|null)=>{
    if(!input)return null;let file=files.get(input.data);
    if(!file){file=draftToFile(input);files.set(input.data,file);}return file;
  };
  return record.photos.map(photo=>({...photo,selected:restore(photo.selected),source:restore(photo.source),pending:restore(photo.pending)}));
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

async function readAnyDraft(key: string): Promise<AnyDraftRecord | null> {
  const database = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const transaction = database.transaction(storeName, "readonly");
      const request = transaction.objectStore(storeName).get(key);
      transaction.onerror = () => reject(transaction.error ?? new Error("Draft read failed"));
      request.onsuccess = () => {
        if (request.result === undefined) { resolve(null); return; }
        const result = anyDraftSchema.safeParse(request.result);
        if (!result.success || result.data.key !== key) { reject(new Error("Draft data is invalid")); return; }
        resolve(Date.now() - result.data.updatedAt > lifetime ? null : result.data);
      };
    });
  } finally { database.close(); }
}

export async function readDraft(key:string):Promise<DraftRecord|null>{
  const record=await readAnyDraft(key);if(record&&record.version!==1)throw new Error("Use the gallery draft reader for version two");return record;
}
export async function readGalleryDraft(key:string):Promise<GalleryDraftRecord|null>{const record=await readAnyDraft(key);return record?upgradeDraft(record):null;}

// Compare and mutate within one read-write transaction, including across tabs.
export async function writeDraft(record: AnyDraftRecord | null, key: string, expectedRevision: string | null): Promise<void> {
  if (record) anyDraftSchema.parse(record);
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
        let current: AnyDraftRecord | null = null;
        let count = 0;
        let totalBytes = 0;
        for (const raw of all.result as unknown[]) {
          const parsed = anyDraftSchema.safeParse(raw);
          if (!parsed.success) { failure = new Error("Draft data is invalid"); transaction.abort(); return; }
          const entry = parsed.data;
          if (now - entry.updatedAt > lifetime) { store.delete(entry.key); continue; }
          count++;
          if (entry.key === key) current = entry;
          else totalBytes += storedPhotoBytes(entry);
        }
        if ((current?.revision ?? null) !== expectedRevision) { failure = new DraftConflict("Draft changed in another tab"); transaction.abort(); return; }
        if (record && !current && count >= maxDrafts) { failure = new DraftCapacity("Draft storage is full"); transaction.abort(); return; }
        if (record) totalBytes += storedPhotoBytes(record);
        if (record && totalBytes > maxStoredPhotoBytes) { failure = new DraftCapacity("Draft storage is full"); transaction.abort(); return; }
        if (record) store.put(record); else if (current) store.delete(key);
        } catch (error) { failure = error instanceof Error ? error : new Error("Draft write failed"); transaction.abort(); }
      };
    });
  } finally { database.close(); }
}
