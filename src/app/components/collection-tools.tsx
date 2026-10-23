"use client";

import Image from "next/image";
import { useActionState, useEffect, useMemo, useRef, useState, type ChangeEvent, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { addItemsToCollectionAction, removeCollectionMembershipAction, setCollectionCoverAction, type ActionFeedback } from "@/app/actions";
import { FormSubmitButton } from "./form-submit-button";
import { useI18n } from "@/i18n/provider";
import { CollectionEmojiField } from "./collection-emoji-field";

const idle: ActionFeedback = { status: "idle", message: "" };
type SelectableItem = { id: string; name: string; model: string | null; category: string | null; mediaId: string | null };
type CoverPhoto = { itemId: string; name: string; model: string | null; mediaId: string };

function handleDialogKeys(event: KeyboardEvent<HTMLElement>, close: () => void) {
  if (event.key === "Escape") { close(); return; }
  if (event.key !== "Tab") return;
  const focusable = Array.from(event.currentTarget.querySelectorAll<HTMLElement>("button:not([disabled]),input:not([disabled]):not([type='hidden']):not(.visually-hidden),select:not([disabled]),a[href]"));
  const first = focusable[0]; const last = focusable.at(-1);
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
}

export function CollectionAddItems({ collectionId, items, existingIds }: { collectionId: string; items: SelectableItem[]; existingIds: string[] }) {
  const { t } = useI18n();
  const [feedback, action] = useActionState(addItemsToCollectionAction, idle);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const dialogRef = useRef<HTMLElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);
  const router = useRouter();
  const existing = useMemo(() => new Set(existingIds), [existingIds]);
  const available = useMemo(() => items.filter((item) => !existing.has(item.id) && `${item.name} ${item.model ?? ""} ${item.category ?? ""}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())), [items, existing, query]);
  useEffect(() => { if (open) { wasOpen.current = true; dialogRef.current?.querySelector<HTMLElement>("input")?.focus(); } else if (wasOpen.current) { wasOpen.current = false; triggerRef.current?.focus(); } }, [open]);
  useEffect(() => {
    if (feedback.status === "success") { setOpen(false); setSelected([]); setQuery(""); router.refresh(); }
  }, [feedback, router]);
  return <>
    <button ref={triggerRef} type="button" className="add-button" onClick={() => setOpen(true)}>{t("collectionAddItems")}</button>
    {open ? <div className="photo-source-overlay add-dialog-overlay" role="presentation"><section ref={dialogRef} className="photo-source-dialog collection-items-dialog" role="dialog" aria-modal="true" aria-labelledby="collection-items-title" onKeyDown={(event) => handleDialogKeys(event, () => setOpen(false))}>
      <div className="dialog-heading"><h3 id="collection-items-title">{t("collectionAddItems")}</h3><button type="button" className="icon-button" aria-label={t("close")} onClick={() => setOpen(false)}>×</button></div>
      {items.length ? <form action={action}>
        <input type="hidden" name="collectionId" value={collectionId}/>
        {selected.map((id) => <input key={id} type="hidden" name="itemId" value={id}/>)}
        <label className="search-field collection-item-search"><span aria-hidden="true">⌕</span><input value={query} maxLength={160} placeholder={t("searchItems")} onChange={(event) => setQuery(event.target.value)}/></label>
        <div className="collection-item-options" role="group" aria-label={t("collectionAddItems")}>
          {available.length ? available.map((item) => <label className="collection-item-option" key={item.id}>
            <input type="checkbox" checked={selected.includes(item.id)} onChange={(event) => setSelected((value) => event.target.checked ? [...value, item.id] : value.filter((id) => id !== item.id))}/>
            {item.mediaId ? <Image src={`/media/${item.id}/${item.mediaId}?variant=thumbnail`} alt="" width={52} height={52} unoptimized/> : <span className="item-thumb" aria-hidden="true">{t("photoMissing")}</span>}
            <span className="collection-item-choice-text"><strong>{item.name}</strong>{item.model ? <small>{item.model}</small> : null}{item.category ? <small>{item.category}</small> : null}</span>
          </label>) : <p className="collection-items-no-results">{t(existing.size ? "noMatches" : "collectionNoInventory")}</p>}
        </div>
        {feedback.status === "error" && feedback.message ? <p className="inline-status error-status" role="alert">{feedback.message}</p> : null}
        <div className="dialog-actions"><FormSubmitButton className="add-button" disabled={!selected.length} pendingLabel={t("adding")}>{t("collectionAddItems")}{selected.length ? ` ${selected.length}` : ""}</FormSubmitButton><button type="button" className="text-button" onClick={() => setOpen(false)}>{t("cancel")}</button></div>
      </form> : <div className="empty-state collection-picker-empty"><h3>{t("collectionNoInventory")}</h3><a className="quiet-button link-button" href="/">{t("addItem")}</a><button type="button" className="text-button" onClick={() => setOpen(false)}>{t("cancel")}</button></div>}
    </section></div> : null}
    {feedback.status === "success" && feedback.message ? <p className="visually-hidden" role="status">{feedback.message}</p> : null}
  </>;
}

export function CollectionCoverManager({ collectionId, options }: { collectionId: string; options: CoverPhoto[] }) {
  const { t } = useI18n();
  const [feedback, action] = useActionState(setCollectionCoverAction, idle);
  const [open, setOpen] = useState(false);
  const [coverType, setCoverType] = useState("default");
  const [selectedPhoto, setSelectedPhoto] = useState("");
  const [icon, setIcon] = useState("🤖");
  const [coverPreview, setCoverPreview] = useState("");
  const coverFile = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);
  const router = useRouter();
  useEffect(() => () => { if (coverPreview) URL.revokeObjectURL(coverPreview); }, [coverPreview]);
  useEffect(() => { if (!open && coverPreview) setCoverPreview(""); }, [open, coverPreview]);
  useEffect(() => { if (open) { wasOpen.current = true; dialogRef.current?.querySelector<HTMLElement>("select")?.focus(); } else if (wasOpen.current) { wasOpen.current = false; triggerRef.current?.focus(); } }, [open]);
  useEffect(() => { if (feedback.status === "success") { setOpen(false); router.refresh(); } }, [feedback, router]);
  return <>
    <button ref={triggerRef} type="button" className="quiet-button" onClick={() => setOpen(true)}>{t("collectionChangeCover")}</button>
    {open ? <div className="photo-source-overlay add-dialog-overlay" role="presentation"><section ref={dialogRef} className="photo-source-dialog collection-cover-dialog" role="dialog" aria-modal="true" aria-labelledby="collection-cover-title" onKeyDown={(event) => handleDialogKeys(event, () => setOpen(false))}>
      <div className="dialog-heading"><h3 id="collection-cover-title">{t("collectionCover")}</h3><button type="button" className="icon-button" aria-label={t("close")} onClick={() => setOpen(false)}>×</button></div>
      <form action={action} className="collection-cover-form"><input type="hidden" name="collectionId" value={collectionId}/>
        <label className="field"><span>{t("collectionCover")}</span><select name="coverType" value={coverType} onChange={(event) => setCoverType(event.target.value)}><option value="default">{t("collectionCoverDefault")}</option><option value="item_photo" disabled={!options.length}>{t("collectionCoverItem")}</option><option value="upload">{t("collectionCoverUpload")}</option><option value="emoji">{t("collectionCoverEmoji")}</option></select></label>
        {coverType === "item_photo" ? <label className="field"><span>{t("collectionCoverPickItem")}</span><select name="selectedPhoto" value={selectedPhoto} required onChange={(event) => setSelectedPhoto(event.target.value)}><option value="">{t("selectCategory")}</option>{options.map((option) => <option key={option.itemId} value={`${option.itemId}:${option.mediaId}`}>{option.name}{option.model ? ` ${option.model}` : ""}</option>)}</select></label> : null}
        {coverType === "upload" ? <><input ref={coverFile} className="visually-hidden" tabIndex={-1} aria-hidden="true" type="file" name="coverFile" accept="image/jpeg,image/png,image/webp" required onChange={(event: ChangeEvent<HTMLInputElement>) => { const file = event.target.files?.[0]; setCoverPreview(file ? URL.createObjectURL(file) : ""); }}/><button type="button" className="photo-source-button collection-cover-pick" onClick={() => coverFile.current?.click()}>{t("collectionCoverUpload")}</button>{coverPreview ? <div className="collection-cover-preview"><Image src={coverPreview} alt={t("collectionCoverPreview")} width={480} height={240} unoptimized/></div> : null}</> : null}
        {coverType === "emoji" ? <CollectionEmojiField label={t("collectionIcon")} value={icon} onChange={setIcon} required/> : null}
        {feedback.status === "error" && feedback.message ? <p className="inline-status error-status" role="alert">{feedback.message}</p> : null}
        <div className="dialog-actions"><FormSubmitButton className="add-button" pendingLabel={t("savingChanges")}>{t("collectionCoverSave")}</FormSubmitButton><button type="button" className="text-button" onClick={() => setOpen(false)}>{t("cancel")}</button></div>
      </form>
    </section></div> : null}
    {feedback.status === "success" && feedback.message ? <p className="visually-hidden" role="status">{feedback.message}</p> : null}
  </>;
}

export function RemoveCollectionItem({ collectionId, itemId }: { collectionId: string; itemId: string }) {
  const { t } = useI18n();
  const [feedback, action] = useActionState(removeCollectionMembershipAction, idle);
  const router = useRouter();
  useEffect(() => { if (feedback.status === "success") router.refresh(); }, [feedback, router]);
  return <form action={action} className="collection-item-remove"><input type="hidden" name="collectionId" value={collectionId}/><input type="hidden" name="itemId" value={itemId}/><FormSubmitButton className="text-button" pendingLabel={t("removing")}>{t("remove")}</FormSubmitButton>{feedback.status === "error" && feedback.message ? <span className="inline-status error-status" role="alert">{feedback.message}</span> : null}</form>;
}
