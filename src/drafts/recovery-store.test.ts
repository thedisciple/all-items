import {expect,it} from "vitest";
import {fileToDraft,galleryDraftFiles,storedPhotoBytes,upgradeDraft,type DraftRecord} from "./recovery-store";

function legacy():DraftRecord{
  const source=new File([new Uint8Array(200)],"synthetic-source.png",{type:"image/png",lastModified:123});
  const selected=new File([new Uint8Array(100)],"synthetic-crop.webp",{type:"image/webp",lastModified:456});
  return{version:1,key:"00000000-0000-4000-8000-000000000001:add-item",revision:"11111111-1111-4111-8111-111111111111",updatedAt:1000,
    fields:{name:"Synthetic draft",model:"",brand:"",categories:[],trackingMode:"unique",originalMarking:"",description:"",notes:"",identificationStatus:"unknown",saleIntent:"not_for_sale",askingPrice:"",askingCurrency:""},rows:[{location:"",quantity:"1"}],categoryPresentation:[],
    photo:{selected:fileToDraft(selected),source:fileToDraft(source),pending:fileToDraft(source),crop:{x:1,y:2,width:80,height:100,rotate:0,scaleX:1,scaleY:1}}};
}

it("upgrades legacy records in memory without changing revision, time, fields or Blob identities",()=>{
  const before=legacy(),record=upgradeDraft(before),other=upgradeDraft(before);
  expect(record.version).toBe(2);expect(record.revision).toBe(before.revision);expect(record.updatedAt).toBe(before.updatedAt);
  expect(record.fields).toEqual(before.fields);expect(record.operationId).toBe(other.operationId);expect(record.photos[0]!.id).toBe(other.photos[0]!.id);
  expect(record.photos[0]!.selected!.data).toBe(before.photo!.selected!.data);expect(record.photos[0]!.pending!.data).toBe(before.photo!.pending!.data);
  expect(before.version).toBe(1);expect("operationId"in before).toBe(false);
});

it("restores accepted and pending inputs while counting source aliases once",async()=>{
  const record=upgradeDraft(legacy());expect(storedPhotoBytes(record)).toBe(300);
  const cloned=structuredClone(record);expect(storedPhotoBytes(cloned)).toBe(300);
  const photo=galleryDraftFiles(cloned)[0]!;expect(photo.source).toBe(photo.pending);expect(photo.selected).not.toBe(photo.source);
  expect(photo.source!.name).toBe("synthetic-source.png");expect(photo.source!.lastModified).toBe(123);expect(photo.selected!.lastModified).toBe(456);
  expect(photo.crop).toEqual(record.photos[0]!.crop);expect(photo.pendingCrop).toBeNull();
  expect(await photo.source!.arrayBuffer()).toEqual(await record.photos[0]!.source!.data.arrayBuffer());
});

it("preserves empty legacy text-only records without a phantom photo",()=>{
  const draft=legacy();draft.photo=null;const record=upgradeDraft(draft);
  expect(record.photos).toEqual([]);expect(record.primaryId).toBeNull();expect(record.selectedId).toBeNull();expect(record.visibleIndex).toBe(0);
  expect(record.fields.name).toBe(draft.fields.name);expect(storedPhotoBytes(record)).toBe(0);
});
