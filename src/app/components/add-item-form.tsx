"use client";

import Link from "next/link";
import {CurrencyFields} from "./currency-fields";
import {suggestedCurrency,validPrice} from "@/items/currencies";
import {LockKeyhole,Plus,X} from "lucide-react";
import {startTransition,useActionState,useCallback,useEffect,useMemo,useRef,useState} from "react";
import {createPortal,flushSync} from "react-dom";
import {useRouter} from "next/navigation";
import {stageCreationPhotoAction,finalizeCreationAction,type CreationFeedback} from "@/app/creation-actions";
import {DraftConflict,fileToDraft,galleryDraftFiles,readGalleryDraft,writeDraft,type DraftFields,type GalleryDraftRecord} from "@/drafts/recovery-store";
import {creationRequest} from "@/drafts/creation-request";
import type {Presentation} from "@/items/inventory-presentation";
import {FormSubmitButton} from "./form-submit-button";
import {InventoryStockFields,validStockDraft,type StockDraft} from "./inventory-stock-fields";
import {CategoryField} from "./category-field";
import {useInventory} from "./inventory-provider";
import {useI18n} from "@/i18n/provider";
import {MultiPhotoDraft,emptyDraftGallery,type DraftGallery} from "./multi-photo-draft";
import {DestructiveConfirmation} from "./destructive-confirmation";
import {useExitEditor,useItemExit} from "./item-exit";

const idle:CreationFeedback={status:"idle",message:""};
type Draft={name:string;model:string;brand:string;categories:string[];trackingMode:string;originalMarking:string;description:string;notes:string;identificationStatus:string;saleIntent:string;askingPrice:string;askingCurrency:string};
const emptyFields=():Draft=>({name:"",model:"",brand:"",categories:[],trackingMode:"unique",originalMarking:"",description:"",notes:"",identificationStatus:"unknown",saleIntent:"not_for_sale",askingPrice:"",askingCurrency:""});

export function AddItemForm(){
  const {inventory}=useInventory();
  return <ScopedAddItemForm key={inventory.workspaceId}/>;
}

function ScopedAddItemForm(){
  const {locale,t}=useI18n();
  const {base,inventory}=useInventory();
  const exit=useItemExit(),router=useRouter();
  const [draft,setDraft]=useState<Draft>(emptyFields);
  const [rows,setRows]=useState<StockDraft[]>([{location:"",quantity:"1"}]);
  const [categoryDraft,setCategoryDraft]=useState<Presentation[]>([]);
  const [gallery,setGallery]=useState<DraftGallery>(emptyDraftGallery);
  const [operationId,setOperationId]=useState("");
  const [open,setOpen]=useState(false),[mounted,setMounted]=useState(false),[resetToken,setResetToken]=useState(0);
  const [galleryBusy,setGalleryBusy]=useState(false),[attempted,setAttempted]=useState(false);
  const [storedDraft,setStoredDraft]=useState<GalleryDraftRecord|null>(null),[storageReady,setStorageReady]=useState(false);
  const [storageError,setStorageError]=useState<""|"draftStorageFailed"|"draftStorageConflict"|"draftSavedCleanupFailed">("");
  const [cleanupPending,setCleanupPending]=useState(false);
  const [progress,setProgress]=useState<{number:number;total:number}| "commit"|null>(null);
  const triggerRef=useRef<HTMLButtonElement>(null),dialogRef=useRef<HTMLElement>(null),formRef=useRef<HTMLFormElement>(null);
  const revision=useRef<string|null>(null),storageEnabled=useRef(true),finalizing=useRef(false),hasQueued=useRef(false),submitLocked=useRef(false);
  const queue=useRef<Promise<void>>(Promise.resolve()),queueCount=useRef(0),timer=useRef<ReturnType<typeof setTimeout>|null>(null);
  const draftKey=inventory.workspaceId+":add-item";
  const meaningful=Boolean([draft.name,draft.model,draft.brand,draft.originalMarking,draft.description,draft.notes,draft.askingPrice].some(value=>value.trim())||draft.categories.length||draft.identificationStatus!=="unknown"||draft.saleIntent!=="not_for_sale"||draft.askingCurrency||draft.trackingMode!=="unique"||rows.some(row=>row.location.trim()||row.quantity!=="1")||gallery.photos.length);
  const dirty=meaningful;
  const snapshot=useMemo<GalleryDraftRecord|null>(()=>!meaningful||!operationId?null:{
    version:2,key:draftKey,revision:crypto.randomUUID(),updatedAt:Date.now(),operationId,fields:draft as DraftFields,rows,
    categoryPresentation:categoryDraft.filter(entry=>draft.categories.includes(entry.category)),
    photos:gallery.photos.map(photo=>({id:photo.id,selected:photo.selected?fileToDraft(photo.selected):null,source:photo.source?fileToDraft(photo.source):null,pending:photo.pending?fileToDraft(photo.pending):null,crop:photo.crop,pendingCrop:photo.pendingCrop??null})),
    primaryId:gallery.primaryId,selectedId:gallery.selectedId,visibleIndex:Math.max(0,gallery.photos.findIndex(photo=>photo.id===gallery.selectedId)),
  },[meaningful,operationId,draftKey,draft,rows,categoryDraft,gallery]);
  const latestSnapshot=useRef<GalleryDraftRecord|null>(null);latestSnapshot.current=finalizing.current||storedDraft?null:snapshot;

  function enqueue(record:GalleryDraftRecord|null){
    hasQueued.current=Boolean(record);queueCount.current++;
    const operation=queue.current.then(async()=>{
      if(!storageEnabled.current)throw new Error("Draft storage unavailable");
      await writeDraft(record,draftKey,revision.current);revision.current=record?.revision??null;
    });
    queue.current=operation.catch(error=>{storageEnabled.current=false;setStorageError(error instanceof DraftConflict?"draftStorageConflict":"draftStorageFailed");}).finally(()=>{queueCount.current--;});
    return operation;
  }
  const enqueueRef=useRef(enqueue);enqueueRef.current=enqueue;
  async function flushDraft(){
    if(timer.current){clearTimeout(timer.current);timer.current=null;}
    if(storageEnabled.current&&latestSnapshot.current)await enqueue(latestSnapshot.current);
    else await queue.current;
  }

  const [feedback,action,pending]=useActionState(async(_previous:CreationFeedback,data:FormData):Promise<CreationFeedback>=>{
    try{
      try{await flushDraft();}catch{/* The visible storage warning remains; current Files stay in memory. */}
      const fields:DraftFields={...draft as DraftFields,askingCurrency:String(data.get("askingCurrency")??draft.askingCurrency)};
      const frozen=await creationRequest(inventory.workspaceId,operationId,fields,rows,categoryDraft.filter(entry=>draft.categories.includes(entry.category)),gallery);
      const encoded=JSON.stringify(frozen);
      for(const [index,photo]of gallery.photos.entries()){
        setProgress({number:index+1,total:gallery.photos.length});
        const request=new FormData();request.set("inventoryId",inventory.workspaceId);request.set("command",encoded);request.set("photoId",photo.id);
        request.set("photo",photo.selected!);if(photo.source&&photo.source!==photo.selected)request.set("photoSource",photo.source);
        const result=await stageCreationPhotoAction(request);
        if(result.status==="error"||result.itemId)return result;
        if(!result.ready)return{status:"error",message:"creationPhotosFailed"};
      }
      setProgress("commit");
      const request=new FormData();request.set("inventoryId",inventory.workspaceId);request.set("command",encoded);
      return await finalizeCreationAction(request);
    }catch{return{status:"error",message:"creationAcknowledgementFailed"};}
  },idle);

  const saveForExit=useCallback(()=>{
    flushSync(()=>setOpen(true));const form=formRef.current;
    if(!form||!form.reportValidity()||form.querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled)return false;
    form.requestSubmit();return true;
  },[]);
  useExitEditor(attempted&&meaningful,pending||cleanupPending||galleryBusy,saveForExit);

  useEffect(()=>{setOperationId(crypto.randomUUID());setMounted(true);},[]);
  useEffect(()=>{
    let active=true;
    void readGalleryDraft(draftKey).then(value=>{if(active){revision.current=value?.revision??null;setStoredDraft(value);setStorageReady(true);}})
      .catch(()=>{if(active){storageEnabled.current=false;setStorageError("draftStorageFailed");setStorageReady(true);}});
    return()=>{active=false;};
  },[draftKey]);
  useEffect(()=>{
    if(!storageReady||storedDraft||!storageEnabled.current||finalizing.current||cleanupPending)return;
    if(!snapshot){if(hasQueued.current||revision.current)void enqueue(null).catch(()=>{});return;}
    timer.current=setTimeout(()=>{timer.current=null;void enqueue(snapshot).catch(()=>{});},200);
    return()=>{if(timer.current){clearTimeout(timer.current);timer.current=null;}};
  },[storageReady,storedDraft,snapshot,cleanupPending]);
  useEffect(()=>{
    const unload=(event:BeforeUnloadEvent)=>{if(!finalizing.current&&latestSnapshot.current&&(timer.current!==null||queueCount.current>0||!storageEnabled.current)){event.preventDefault();event.returnValue="";}};
    window.addEventListener("beforeunload",unload);
    return()=>{window.removeEventListener("beforeunload",unload);if(!finalizing.current&&storageEnabled.current&&latestSnapshot.current)void enqueueRef.current(latestSnapshot.current).catch(()=>{});};
  },[]);
  useEffect(()=>{if(!meaningful&&!cleanupPending)finalizing.current=false;},[meaningful,cleanupPending,resetToken]);

  function resetDraft(){
    latestSnapshot.current=null;setDraft(emptyFields());setRows([{location:"",quantity:"1"}]);setCategoryDraft([]);setGallery(emptyDraftGallery());setOperationId(crypto.randomUUID());setAttempted(false);setResetToken(value=>value+1);setProgress(null);
  }
  function restoreStored(){
    if(!storedDraft)return;
    setDraft(storedDraft.fields);setRows(storedDraft.rows);setCategoryDraft(storedDraft.categoryPresentation);
    setGallery({photos:galleryDraftFiles(storedDraft),primaryId:storedDraft.primaryId,selectedId:storedDraft.selectedId});
    setOperationId(storedDraft.operationId);setResetToken(value=>value+1);setStoredDraft(null);
  }
  async function discardStored(){try{await enqueue(null);setStoredDraft(null);}catch{/* Preserve another tab's committed revision and the restore/discard choice. */}}
  async function discardCurrent(){
    finalizing.current=true;latestSnapshot.current=null;
    if(timer.current){clearTimeout(timer.current);timer.current=null;}
    try{if(storageEnabled.current)await enqueue(null);}catch{/* Keep a newer committed record; only this in-memory draft is discarded. */}
    resetDraft();return{status:"success" as const,message:"" as const};
  }
  useEffect(()=>{
    if(feedback.status==="error"){submitLocked.current=false;setProgress(null);exit?.failed();return;}
    if(feedback.status!=="success"||!feedback.itemId)return;
    const savedId=feedback.itemId;finalizing.current=true;latestSnapshot.current=null;setCleanupPending(true);
    void(async()=>{
      try{
        if(storageEnabled.current&&(revision.current!==null||hasQueued.current||meaningful))await enqueue(null);
        else if(!storageEnabled.current&&(revision.current!==null||hasQueued.current))throw new Error("Draft cleanup unavailable");
      }catch{setStorageError("draftSavedCleanupFailed");}
      resetDraft();setOpen(false);setCleanupPending(false);submitLocked.current=false;
      const target=base+"?added="+savedId;if(exit)exit.saved(target);else router.push(target);
    })();
  },[feedback,base,router,exit]);
  useEffect(()=>{if(open)dialogRef.current?.querySelector<HTMLElement>("button:not([disabled]),input:not([disabled]):not([type='hidden']):not(.visually-hidden),select:not([disabled]),textarea:not([disabled])")?.focus();},[open]);
  const update=(key:keyof Draft)=>(event:React.ChangeEvent<HTMLInputElement|HTMLTextAreaElement>)=>setDraft(current=>({...current,[key]:event.target.value}));
  const blocked=pending||cleanupPending||galleryBusy;
  const validPhotos=gallery.photos.every(photo=>photo.selected&&!photo.pending);
  const canSave=Boolean(operationId&&(draft.name.trim()||gallery.photos.length)&&validPhotos&&validPrice(draft.askingPrice,draft.askingCurrency||suggestedCurrency(locale))&&validStockDraft(rows,draft.trackingMode));
  const close=()=>{if(!blocked){setOpen(false);triggerRef.current?.focus();}};

  return <>
    <button ref={triggerRef} type="button" className="add-button add-dialog-trigger" onClick={()=>setOpen(true)}><Plus size={17} aria-hidden="true"/><span>{t("addItem")}</span></button>
    {storageError&&!open?<p className="form-error" role="alert">{t(storageError)}</p>:null}
    {mounted?createPortal(<div className="photo-source-overlay add-dialog-overlay" role="presentation" hidden={!open}>
      <section ref={dialogRef} className="photo-source-dialog add-item-dialog" role="dialog" aria-modal="true" aria-labelledby="add-item-title" onKeyDown={event=>{
        const target=event.target;if(target instanceof HTMLElement&&target.closest('[role="dialog"]')!==event.currentTarget)return;
        if(event.key==="Escape"){if(!dirty&&!blocked)close();return;}
        if(event.key!=="Tab")return;
        const focusable=[...event.currentTarget.querySelectorAll<HTMLElement>("button:not([disabled]),input:not([disabled]):not([type='hidden']):not(.visually-hidden),select:not([disabled]),textarea:not([disabled]),[tabindex='0']")].filter(node=>node.getClientRects().length);
        const first=focusable[0],last=focusable.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
      }}>
        <div className="dialog-heading"><h2 id="add-item-title">{t("addItem")}</h2><button type="button" className="icon-button" aria-label={t("close")} disabled={blocked} onClick={close}><X size={18} aria-hidden="true"/></button></div>
        {storageError?<p className="form-error" role="alert">{t(storageError)}</p>:null}
        {pending||cleanupPending?<p role="status" aria-live="polite">{progress&&progress!=="commit"?t("creationPreparingPhotos",progress):t("creationCommitting")}</p>:null}
        {!storageReady?<p role="status">{t("draftLoading")}</p>:storedDraft?<div className="draft-recovery" role="group" aria-label={t("draftRecoveryTitle")}><h3>{t("draftRecoveryTitle")}</h3><p>{t("draftRecoveryPrompt")}</p><div className="dialog-actions"><button type="button" className="add-button" onClick={restoreStored}>{t("draftRestore")}</button><button type="button" className="quiet-button" onClick={()=>void discardStored()}>{t("draftDiscardSaved")}</button></div></div>:<form ref={formRef} aria-busy={pending||cleanupPending} inert={pending||cleanupPending} className="photo-add-form" onSubmit={event=>{
          event.preventDefault();if(submitLocked.current||blocked||!canSave)return;submitLocked.current=true;setAttempted(true);const data=new FormData(event.currentTarget);startTransition(()=>action(data));
        }}>
          <MultiPhotoDraft key={resetToken} value={gallery} onChange={setGallery} disabled={pending||cleanupPending} active={open} restoreToken={resetToken} onBusyChange={setGalleryBusy} itemName={draft.name||t("unidentifiedItemName")}/>
          <div className="photo-add-fields">
            <label className="field"><span>{t("itemName")}</span><input name="name" value={draft.name} placeholder={t("itemNamePlaceholder")} maxLength={160} onChange={update("name")}/></label>
            <label className="field"><span>{t("itemModel")}</span><input name="model" value={draft.model} placeholder={t("itemModelPlaceholder")} maxLength={160} onChange={update("model")}/></label>
            <label className="field"><span>{t("itemBrand")}</span><input name="brand" value={draft.brand} placeholder={t("brandPlaceholder")} maxLength={120} onChange={update("brand")}/></label>
            <CategoryField key={resetToken} values={draft.categories} onValueChange={(categories) => setDraft((current) => ({ ...current, categories }))} presentations={categoryDraft} onPresentationChange={setCategoryDraft}/>
          </div>
          <InventoryStockFields mode={draft.trackingMode} rows={rows} onModeChange={trackingMode => setDraft(value => ({ ...value, trackingMode }))} onRowsChange={setRows}/>
          <details className="advanced-fields"><summary>{t("additionalDetails")}</summary><div className="detail-grid advanced-item-fields">
            <label className="field"><span>{t("itemOriginalMarking")}</span><input name="originalMarking" value={draft.originalMarking} placeholder={t("markingPlaceholder")} maxLength={160} onChange={update("originalMarking")}/></label>
            <label className="field"><span>{t("identificationStatus")}</span><select name="identificationStatus" value={draft.identificationStatus} onChange={(event) => setDraft((current) => ({ ...current, identificationStatus: event.target.value }))}><option value="unknown">{t("itemStatusUnknown")}</option><option value="user_confirmed">{t("itemStatusConfirmed")}</option><option value="source_verified">{t("itemStatusVerified")}</option></select></label>
            <label className="field"><span className="private-field-label"><LockKeyhole size={12} aria-hidden="true"/>{t("saleIntent")}</span><select name="saleIntent" value={draft.saleIntent} onChange={(event) => setDraft((current) => ({ ...current, saleIntent: event.target.value }))}><option value="not_for_sale">{t("saleNo")}</option><option value="considering">{t("saleConsidering")}</option><option value="willing_to_sell">{t("saleYes")}</option></select></label>
            <CurrencyFields price={draft.askingPrice} currency={draft.askingCurrency} onPriceChange={askingPrice => setDraft(value => ({...value,askingPrice}))} onCurrencyChange={askingCurrency => setDraft(value => ({...value,askingCurrency}))}/>
            <label className="field full-field"><span>{t("itemDescription")}</span><textarea name="description" maxLength={4000} value={draft.description} onChange={update("description")}/></label>
            <label className="field full-field"><span className="private-field-label"><LockKeyhole size={12} aria-hidden="true"/>{t("itemNotes")}</span><textarea name="notes" maxLength={2000} value={draft.notes} onChange={update("notes")}/></label>
          </div></details>


          {!pending&&attempted&&feedback.status==="error"&&feedback.message?<div className="creation-error"><p className="form-error" role="alert">{t(feedback.message,feedback.values)}</p>
            {feedback.completedOperation?<div className="dialog-actions">{feedback.itemId?<Link className="quiet-button" href={base+"/items/"+feedback.itemId}>{t("creationOpenSaved")}</Link>:null}<button type="button" className="quiet-button" onClick={()=>{setOperationId(crypto.randomUUID());setAttempted(false);}}>{t("creationUseForAnother")}</button></div>:null}
          </div>:null}
          <div className="dialog-actions"><FormSubmitButton className="add-button" disabled={blocked||!canSave} pendingLabel={t("addingItem")}><Plus size={16} aria-hidden="true"/><span>{pending?t("addingItem"):t("saveItem")}</span></FormSubmitButton><button type="button" className="text-button" disabled={blocked} onClick={close}>{t("close")}</button>
            {dirty&&!blocked?<DestructiveConfirmation refreshOnSuccess={false} action={discardCurrent} label={t("discardDraft")} description={t("discardDraftConfirm")} fields={{}}/>:null}
          </div>
        </form>}
      </section>
    </div>,document.body):null}
  </>;
}
