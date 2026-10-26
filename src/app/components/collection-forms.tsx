"use client";

import { ActionForm } from "./action-form";

import { useActionState, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { createCollectionAction, deleteCollectionAction, renameCollectionAction, type ActionFeedback } from "@/app/actions";
import { FormSubmitButton } from "./form-submit-button";
import { DestructiveConfirmation } from "./destructive-confirmation";
import { useInventory } from "./inventory-provider";
import { useI18n } from "@/i18n/provider";
import { Pencil, Plus, X } from "lucide-react";
import { CollectionEmojiField } from "./collection-emoji-field";

const idle: ActionFeedback = { status: "idle", message: "" };

function handleDialogKeys(event: KeyboardEvent<HTMLElement>, close: () => void) {
  if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); close(); return; }
  if (event.key !== "Tab") return;
  const focusable = Array.from(event.currentTarget.querySelectorAll<HTMLElement>("button:not([disabled]),input:not([disabled]):not([type='hidden']):not(.visually-hidden),select:not([disabled]),a[href]"));
  const first = focusable[0]; const last = focusable.at(-1);
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
}

export function CreateCollectionForm({ tile = false }: { tile?: boolean }) {
  const { t } = useI18n();
  const { base } = useInventory();
  const [feedback, action, actionPending] = useActionState(createCollectionAction, idle);
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("");
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);
  const router = useRouter();
  useEffect(() => {
    if (feedback.status === "success" && feedback.collectionId) {
      setOpen(false); setName(""); setIcon(""); router.push(`${base}/collections/${feedback.collectionId}`);
    }
  }, [feedback, router, base]);
  useEffect(() => { if (open) { wasOpen.current = true; dialogRef.current?.querySelector<HTMLElement>("input")?.focus(); } else if (wasOpen.current) { wasOpen.current = false; triggerRef.current?.focus(); } }, [open]);
  return <>
    <button ref={triggerRef} type="button" className={tile?"collection-create-trigger collection-create-tile":"add-button collection-create-trigger"} onClick={() => setOpen(true)}>{tile?<Plus size={24} aria-hidden="true"/>:null}{t(tile?"collectionNew":"collectionCreateOpen")}</button>
    {open ? <div className="photo-source-overlay add-dialog-overlay" role="presentation"><section ref={dialogRef} className="photo-source-dialog collection-create-dialog" role="dialog" aria-modal="true" aria-labelledby="collection-create-title" onKeyDown={(event) => handleDialogKeys(event, () => {if(!actionPending)setOpen(false);})}>
      <div className="dialog-heading"><h3 id="collection-create-title">{t("collectionCreateOpen")}</h3><button type="button" className="icon-button" aria-label={t("close")} disabled={actionPending} onClick={() => setOpen(false)}><X size={18} aria-hidden="true"/></button></div>
      <ActionForm action={action} pending={actionPending} className="collection-create-form">
        <label className="field"><span>{t("collectionName")}</span><input name="name" value={name} maxLength={120} required placeholder={t("collectionNamePlaceholder")} onChange={(event) => setName(event.target.value)}/></label>
        <CollectionEmojiField label={t("collectionIcon")} value={icon} onChange={setIcon}/>
        {feedback.status === "error" && feedback.message ? <p className="inline-status error-status" role="alert">{feedback.message ? t(feedback.message, feedback.values) : ""}</p> : null}
        <div className="dialog-actions"><FormSubmitButton className="add-button" pendingLabel={t("collectionCreating")}>{t("collectionCreate")}</FormSubmitButton></div>
      </ActionForm>
    </section></div> : null}
  </>;
}

export function CollectionManageForms({ id, name, icon }: { id: string; name: string; icon: string | null }) {
  const { t } = useI18n();
  const [renameFeedback, renameAction, renameActionPending] = useActionState(renameCollectionAction, idle);
  const [draftName, setDraftName] = useState(name);
  const [draftIcon, setDraftIcon] = useState(icon ?? "");
  const [editing, setEditing] = useState(false);
  const router = useRouter();
  const nameInput = useRef<HTMLInputElement>(null);
  const editTrigger = useRef<HTMLButtonElement>(null);
  const wasEditing = useRef(false);
  useEffect(() => { if (renameFeedback.status === "success") { setEditing(false); router.refresh(); } }, [renameFeedback, router]);
  useEffect(() => { if (editing) { wasEditing.current=true;nameInput.current?.focus(); nameInput.current?.select(); } else if(wasEditing.current){wasEditing.current=false;editTrigger.current?.focus();} }, [editing]);
  const close=()=>{if(!renameActionPending)setEditing(false);};
  return <div className="collection-manage-forms">
    <div className="collection-rename-panel">
      <button ref={editTrigger} type="button" className="quiet-button collection-edit-trigger" onClick={() => setEditing(true)}><Pencil size={15} aria-hidden="true"/>{t("collectionEdit")}</button>
      {editing?<div className="photo-source-overlay add-dialog-overlay" role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget)close();}}><section className="photo-source-dialog collection-rename-dialog" role="dialog" aria-modal="true" aria-labelledby="collection-edit-title" onKeyDown={event=>handleDialogKeys(event,close)}>
        <div className="dialog-heading"><h2 id="collection-edit-title">{t("collectionEdit")}</h2><button type="button" className="icon-button" aria-label={t("close")} disabled={renameActionPending} onClick={close}><X size={18} aria-hidden="true"/></button></div>
        <ActionForm action={renameAction} pending={renameActionPending} className="collection-rename-form">
        <input type="hidden" name="id" value={id}/>
        <label className="field"><span>{t("collectionRenameTitle")}</span><input ref={nameInput} name="name" value={draftName} maxLength={120} required onChange={(event) => setDraftName(event.target.value)}/></label>
        <CollectionEmojiField label={t("collectionIcon")} value={draftIcon} onChange={setDraftIcon}/>
        {renameFeedback.status === "error" && renameFeedback.message ? <p className="inline-status error-status" role="alert">{renameFeedback.message ? t(renameFeedback.message, renameFeedback.values) : ""}</p> : null}
        <div className="dialog-actions"><FormSubmitButton disabled={draftName.trim() === name && draftIcon === (icon ?? "")} pendingLabel={t("savingChanges")}>{t("collectionRename")}</FormSubmitButton></div>
      </ActionForm></section></div>:null}
    </div>
    <DestructiveConfirmation action={deleteCollectionAction} label={t("collectionDelete")} description={`${t("collectionDeleteWarning")} «${name}»`} fields={{ id }}/>
    {renameFeedback.status === "success" && renameFeedback.message ? <p className="visually-hidden" role="status">{renameFeedback.message ? t(renameFeedback.message, renameFeedback.values) : ""}</p> : null}
  </div>;
}
