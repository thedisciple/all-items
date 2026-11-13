"use client";

import { ActionForm } from "./action-form";

import { Plus, Image as ImageIcon, LibraryBig, Trash2, X } from "lucide-react";
import { PrivateImage } from "./private-image";
import { useActionState, useEffect, useRef, useState, type ChangeEvent, type KeyboardEvent } from "react";
import {collectionCandidates,collectionPhotos} from "@/app/collection-read-actions";
import { useRouter } from "next/navigation";
import { addItemsToCollectionAction, removeCollectionMembershipAction, setCollectionCoverAction, type ActionFeedback } from "@/app/actions";
import { FormSubmitButton } from "./form-submit-button";
import { useInventory } from "./inventory-provider";
import { useI18n } from "@/i18n/provider";
import { CollectionEmojiField } from "./collection-emoji-field";
import { CategoryTags } from "./category-tag";

const idle: ActionFeedback = { status: "idle", message: "" };
type SelectableItem = { id: string; name: string; model: string | null; categories: string[]; mediaId: string | null };
export type CoverPhoto = { itemId: string; name: string; model: string | null; inventoryNumber: string; mediaId: string; position:number };

function PickerPages({page,pages,pending,onChange}:{page:number;pages:number;pending:boolean;onChange:(page:number)=>void}){
  const {t}=useI18n();return <div className="cover-photo-pages"><button type="button" className="quiet-button" disabled={pending||page<=1} onClick={()=>onChange(page-1)}>{t("pagePrevious")}</button><span>{t("pageOf",{page,pages})}</span><button type="button" className="quiet-button" disabled={pending||page>=pages} onClick={()=>onChange(page+1)}>{t("pageNext")}</button></div>;
}

function handleDialogKeys(event: KeyboardEvent<HTMLElement>, close: () => void) {
  if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); close(); return; }
  if (event.key !== "Tab") return;
  const focusable = Array.from(event.currentTarget.querySelectorAll<HTMLElement>("button:not([disabled]),input:not([disabled]):not([type='hidden']):not(.visually-hidden),select:not([disabled]),a[href]"));
  const first = focusable[0]; const last = focusable.at(-1);
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
}

export function CollectionAddItems({ collectionId }: { collectionId: string }) {
  const { locale,t } = useI18n();
  const { base, presentation,inventory } = useInventory();
  const customEmoji = Object.fromEntries(presentation.categories.map(value => [value.category, value.emoji]));
  const [feedback, action, actionPending] = useActionState(addItemsToCollectionAction, idle);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const dialogRef = useRef<HTMLElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);
  const router = useRouter();
  const [page,setPage]=useState(1),[result,setResult]=useState<{items:SelectableItem[];page:number;pages:number}>({items:[],page:1,pages:1}),[loading,setLoading]=useState(false),[failed,setFailed]=useState(false),[retry,setRetry]=useState(0);
  useEffect(()=>{if(!open)return;let cancelled=false;setLoading(true);setFailed(false);const timer=setTimeout(()=>{void collectionCandidates({inventoryId:inventory.workspaceId,collectionId,query,page}).then(value=>{if(!cancelled)setResult(value);}).catch(()=>{if(!cancelled)setFailed(true);}).finally(()=>{if(!cancelled)setLoading(false);});},200);return()=>{cancelled=true;clearTimeout(timer);};},[open,inventory.workspaceId,collectionId,query,page,retry]);
  const available=result.items;
  const close=()=>{if(!actionPending){setOpen(false);setSelected([]);setQuery("");setPage(1);}};
  useEffect(() => { if (open) { wasOpen.current = true; dialogRef.current?.querySelector<HTMLElement>("input")?.focus(); } else if (wasOpen.current) { wasOpen.current = false; triggerRef.current?.focus(); } }, [open]);
  useEffect(() => {
    if (feedback.status === "success") { setOpen(false); setSelected([]); setQuery(""); setPage(1); router.refresh(); }
  }, [feedback, router]);
  return <>
    <button ref={triggerRef} type="button" className="add-button" onClick={() => setOpen(true)}><Plus size={16} aria-hidden="true"/>{t("collectionAddItems")}</button>
    {open ? <div className="photo-source-overlay add-dialog-overlay" role="presentation"><section ref={dialogRef} className="photo-source-dialog collection-items-dialog" role="dialog" aria-modal="true" aria-labelledby="collection-items-title" onKeyDown={(event) => handleDialogKeys(event, close)}>
      <div className="dialog-heading"><h3 id="collection-items-title">{t("collectionAddItems")}</h3><button type="button" className="icon-button" aria-label={t("close")} disabled={actionPending} onClick={close}><X size={18} aria-hidden="true"/></button></div>
      <ActionForm action={action} pending={actionPending}>
        <input type="hidden" name="collectionId" value={collectionId}/>
        {selected.map((id) => <input key={id} type="hidden" name="itemId" value={id}/>)}
        <label className="search-field collection-item-search"><span aria-hidden="true">⌕</span><input value={query} maxLength={160} placeholder={t("searchItems")} onChange={(event) => {setQuery(event.target.value);setPage(1);}}/></label>
        {failed?<p role="alert">{t("operationFailed")} <button type="button" className="text-button" onClick={()=>setRetry(value=>value+1)}>{t("retry")}</button></p>:null}
        <div className="collection-item-options" role="group" aria-busy={loading} aria-label={t("collectionAddItems")}>
          {available.length ? available.map((item) => <label className="collection-item-option" key={item.id}>
            <input type="checkbox" checked={selected.includes(item.id)} onChange={(event) => setSelected((value) => event.target.checked ? [...value, item.id] : value.filter((id) => id !== item.id))}/>
            {item.mediaId ? <PrivateImage variant="thumbnail" src={`${base}/media/${item.id}/${item.mediaId}?variant=thumbnail`} alt="" width={52} height={52}/> : <span className="item-thumb" aria-hidden="true">{t("photoMissing")}</span>}
            <span className="collection-item-choice-text"><strong>{item.name || t("unidentifiedItemName")}</strong>{item.model ? <small>{item.model}</small> : null}<CategoryTags values={item.categories} locale={locale} customEmoji={customEmoji}/></span>
          </label>) : !loading&&!failed?<p className="collection-items-no-results">{t("noMatches")}</p>:null}
        </div>
        {feedback.status === "error" && feedback.message ? <p className="inline-status error-status" role="alert">{feedback.message ? t(feedback.message, feedback.values) : ""}</p> : null}
        <PickerPages page={result.page} pages={result.pages} pending={loading} onChange={setPage}/>
        <div className="dialog-actions"><FormSubmitButton className="add-button" disabled={!selected.length||selected.length>500} pendingLabel={t("adding")}>{t("collectionAddItems")}{selected.length ? ` (${selected.length})` : ""}</FormSubmitButton></div>
      </ActionForm>
    </section></div> : null}
    {feedback.status === "success" && feedback.message ? <p className="visually-hidden" role="status">{feedback.message ? t(feedback.message, feedback.values) : ""}</p> : null}
  </>;
}

export function CollectionCoverManager({ collectionId, add = false, controlledOpen, onOpenChange }: { collectionId: string; add?: boolean; controlledOpen?: boolean; onOpenChange?: (open:boolean)=>void }) {
  const { t } = useI18n();
  const { base,inventory } = useInventory();
  const [feedback, action, actionPending] = useActionState(setCollectionCoverAction, idle);
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = (value:boolean) => { setInternalOpen(value); onOpenChange?.(value); };
  const [page,setPage] = useState(0);
  const [coverType, setCoverType] = useState("default");
  const [selectedPhoto, setSelectedPhoto] = useState("");
  const [photoQuery,setPhotoQuery] = useState("");
  const [photos,setPhotos]=useState<{items:CoverPhoto[];page:number;pages:number}>({items:[],page:1,pages:1}),[loading,setLoading]=useState(false),[failed,setFailed]=useState(false),[retry,setRetry]=useState(0);
  useEffect(()=>{if(!open||coverType!=="item_photo")return;let cancelled=false;setLoading(true);setFailed(false);const timer=setTimeout(()=>{void collectionPhotos({inventoryId:inventory.workspaceId,collectionId,query:photoQuery,page:page+1}).then(value=>{if(!cancelled)setPhotos(value);}).catch(()=>{if(!cancelled)setFailed(true);}).finally(()=>{if(!cancelled)setLoading(false);});},200);return()=>{cancelled=true;clearTimeout(timer);};},[open,coverType,inventory.workspaceId,collectionId,photoQuery,page,retry]);
  const [icon, setIcon] = useState("🤖");
  const [coverPreview, setCoverPreview] = useState("");
  const coverFile = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);
  const router = useRouter();
  const close=()=>{if(!actionPending){setOpen(false);setCoverType("default");setSelectedPhoto("");setPhotoQuery("");setPage(0);setIcon("🤖");}};
  useEffect(() => () => { if (coverPreview) URL.revokeObjectURL(coverPreview); }, [coverPreview]);
  useEffect(() => { if (!open && coverPreview) setCoverPreview(""); }, [open, coverPreview]);
  useEffect(() => { if (open) { wasOpen.current = true; dialogRef.current?.querySelector<HTMLElement>("select")?.focus(); } else if (wasOpen.current) { wasOpen.current = false; triggerRef.current?.focus(); } }, [open]);
  useEffect(() => { if (feedback.status === "success") { setOpen(false); router.refresh(); } }, [feedback, router]);
  return <>
    {controlledOpen === undefined ? <button ref={triggerRef} type="button" className="quiet-button" onClick={() => setOpen(true)}><ImageIcon size={16} aria-hidden="true"/>{t(add ? "collectionAddCover" : "collectionChangeCover")}</button> : null}
    {open ? <div className="photo-source-overlay collection-cover-overlay" role="presentation"><section ref={dialogRef} className="photo-source-dialog collection-cover-dialog" role="dialog" aria-modal="true" aria-labelledby="collection-cover-title" onKeyDown={(event) => handleDialogKeys(event, close)}>
      <div className="dialog-heading"><h3 id="collection-cover-title">{t("collectionCover")}</h3><button type="button" className="icon-button" aria-label={t("close")} disabled={actionPending} onClick={close}><X size={18} aria-hidden="true"/></button></div>
      <ActionForm action={action} pending={actionPending} className="collection-cover-form"><input type="hidden" name="collectionId" value={collectionId}/>
        <label className="field"><span>{t("collectionCover")}</span><select name="coverType" value={coverType} onChange={(event) => setCoverType(event.target.value)}><option value="default">{t("collectionCoverDefault")}</option><option value="item_photo">{t("collectionCoverItem")}</option><option value="upload">{t("collectionCoverUpload")}</option><option value="emoji">{t("collectionCoverEmoji")}</option></select></label>
        {coverType === "item_photo" ? <div className="cover-photo-picker">
          <input type="hidden" name="selectedPhoto" value={selectedPhoto}/>
          <label className="field"><span>{t("searchItems")}</span><input type="search" value={photoQuery} maxLength={160} onChange={event=>{setPhotoQuery(event.target.value);setPage(0);}}/></label>
          <p>{t("collectionCoverPrimaryUnaffected")}</p>
          {(() => {
            const visible=photos.items;
            const groups=Array.from(new Set(visible.map(option=>option.itemId)));
            return <>{failed?<p role="alert">{t("operationFailed")} <button type="button" className="text-button" onClick={()=>setRetry(value=>value+1)}>{t("retry")}</button></p>:null}<div className="cover-photo-options" role="radiogroup" aria-busy={loading} aria-label={t("collectionCoverPickItem")}>
              {groups.map(id=>{const photos=visible.filter(option=>option.itemId===id),item=photos[0]!;return <fieldset key={id}><legend>{item.name || t("unidentifiedItemName")} · {item.inventoryNumber}</legend>{photos.map(option=>{
                const value=option.itemId+":"+option.mediaId,position=option.position;
                return <label className="cover-photo-choice" key={option.mediaId}><input type="radio" name="coverPhotoChoice" value={value} checked={selectedPhoto===value} onChange={()=>setSelectedPhoto(value)}/><PrivateImage variant="thumbnail" src={base+"/media/"+option.itemId+"/"+option.mediaId+"?variant=thumbnail"} alt=""/><span>{t("galleryPhoto",{number:position})}</span></label>;
              })}</fieldset>;})}
              {!visible.length&&!loading&&!failed?<p>{t("noMatches")}</p>:null}
            </div><PickerPages page={photos.page} pages={photos.pages} pending={loading} onChange={value=>setPage(value-1)}/></>;
          })()}
        </div> : null}
        {coverType === "upload" ? <><input ref={coverFile} className="visually-hidden" tabIndex={-1} aria-hidden="true" type="file" name="coverFile" accept="image/jpeg,image/png,image/webp" required onChange={(event: ChangeEvent<HTMLInputElement>) => { const file = event.target.files?.[0]; setCoverPreview(file ? URL.createObjectURL(file) : ""); }}/><button type="button" className="photo-source-button collection-cover-pick" onClick={() => coverFile.current?.click()}>{t("collectionCoverUpload")}</button>{coverPreview ? <div className="collection-cover-preview"><PrivateImage variant="preview" src={coverPreview} alt={t("collectionCoverPreview")} width={480} height={240}/></div> : null}</> : null}
        {coverType === "default" ? <div className="cover-choice-preview" aria-hidden="true"><LibraryBig size={30}/></div> : null}
        {coverType === "item_photo" && selectedPhoto ? <div className="collection-cover-preview"><PrivateImage variant="preview" src={`${base}/media/${selectedPhoto.replace(":", "/")}?variant=image`} alt={t("collectionCoverPreview")}/></div> : null}
        {coverType === "emoji" ? <><div className="cover-choice-preview" aria-hidden="true">{icon}</div><CollectionEmojiField label={t("collectionCoverEmojiLabel")} value={icon} onChange={setIcon} required/></> : null}
        {feedback.status === "error" && feedback.message ? <p className="inline-status error-status" role="alert">{feedback.message ? t(feedback.message, feedback.values) : ""}</p> : null}
        <div className="dialog-actions"><FormSubmitButton className="add-button" disabled={coverType === "item_photo" && !selectedPhoto} pendingLabel={t("savingChanges")}>{t("collectionCoverSave")}</FormSubmitButton></div>
      </ActionForm>
    </section></div> : null}
    {feedback.status === "success" && feedback.message ? <p className="visually-hidden" role="status">{feedback.message ? t(feedback.message, feedback.values) : ""}</p> : null}
  </>;
}

export function RemoveCollectionItem({ collectionId, itemId }: { collectionId: string; itemId: string }) {
  const { t } = useI18n();
  const [feedback, action, actionPending] = useActionState(removeCollectionMembershipAction, idle);
  const router = useRouter();
  useEffect(() => { if (feedback.status === "success") router.refresh(); }, [feedback, router]);
  return <ActionForm action={action} pending={actionPending} className="collection-item-remove"><input type="hidden" name="collectionId" value={collectionId}/><input type="hidden" name="itemId" value={itemId}/><FormSubmitButton className="icon-button row-remove-button" label={t("remove")} pendingLabel={t("removing")}><Trash2 size={16} aria-hidden="true"/></FormSubmitButton>{feedback.status === "error" && feedback.message ? <span className="inline-status error-status" role="alert">{feedback.message ? t(feedback.message, feedback.values) : ""}</span> : null}</ActionForm>;
}
