"use client";

import { ActionForm } from "./action-form";

import { useActionState, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { createCollectionAction, deleteCollectionAction, renameCollectionAction, type ActionFeedback } from "@/app/actions";
import { FormSubmitButton } from "./form-submit-button";
import { DestructiveConfirmation } from "./destructive-confirmation";
import { useInventory } from "./inventory-provider";
import { useI18n } from "@/i18n/provider";
import { Pencil, X } from "lucide-react";
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

export function CreateCollectionForm() {
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
    <button ref={triggerRef} type="button" className="add-button collection-create-trigger" onClick={() => setOpen(true)}>{t("collectionCreateOpen")}</button>
    {open ? <div className="photo-source-overlay add-dialog-overlay" role="presentation"><section ref={dialogRef} className="photo-source-dialog collection-create-dialog" role="dialog" aria-modal="true" aria-labelledby="collection-create-title" onKeyDown={(event) => handleDialogKeys(event, () => setOpen(false))}>
      <div className="dialog-heading"><h3 id="collection-create-title">{t("collectionCreateOpen")}</h3><button type="button" className="icon-button" aria-label={t("close")} onClick={() => setOpen(false)}><X size={18} aria-hidden="true"/></button></div>
      <ActionForm action={action} pending={actionPending} className="collection-create-form">
        <label className="field"><span>{t("collectionName")}</span><input name="name" value={name} maxLength={120} required placeholder={t("collectionNamePlaceholder")} onChange={(event) => setName(event.target.value)}/></label>
        <CollectionEmojiField label={t("collectionIcon")} value={icon} onChange={setIcon}/>
        {feedback.status === "error" && feedback.message ? <p className="inline-status error-status" role="alert">{feedback.message ? t(feedback.message, feedback.values) : ""}</p> : null}
        <div className="dialog-actions"><FormSubmitButton className="add-button" pendingLabel={t("collectionCreating")}>{t("collectionCreate")}</FormSubmitButton><button type="button" className="quiet-button" onClick={() => setOpen(false)}>{t("cancel")}</button></div>
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
  useEffect(() => { if (renameFeedback.status === "success") { setEditing(false); router.refresh(); } }, [renameFeedback, router]);
  useEffect(() => { if (editing) { nameInput.current?.focus(); nameInput.current?.select(); } }, [editing]);
  return <div className="collection-manage-forms">
    <div className="collection-rename-panel">
      {!editing ? <button type="button" className="quiet-button collection-edit-trigger" onClick={() => { setDraftName(name); setDraftIcon(icon ?? ""); setEditing(true); }}><Pencil size={15} aria-hidden="true"/>{t("collectionEdit")}</button> : <ActionForm action={renameAction} pending={renameActionPending} className="collection-rename-form" onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); setEditing(false); } }}>
        <input type="hidden" name="id" value={id}/>
        <label className="field"><span>{t("collectionRenameTitle")}</span><input ref={nameInput} name="name" value={draftName} maxLength={120} required onChange={(event) => setDraftName(event.target.value)}/></label>
        <CollectionEmojiField label={t("collectionIcon")} value={draftIcon} onChange={setDraftIcon}/>
        {renameFeedback.status === "error" && renameFeedback.message ? <p className="inline-status error-status" role="alert">{renameFeedback.message ? t(renameFeedback.message, renameFeedback.values) : ""}</p> : null}
        <div className="dialog-actions"><FormSubmitButton disabled={draftName.trim() === name && draftIcon === (icon ?? "")} pendingLabel={t("savingChanges")}>{t("collectionRename")}</FormSubmitButton><button type="button" className="quiet-button" onClick={() => setEditing(false)}>{t("cancel")}</button></div>
      </ActionForm>}
    </div>
    <DestructiveConfirmation action={deleteCollectionAction} label={t("collectionDelete")} description={`${t("collectionDeleteWarning")} «${name}»`} fields={{ id }}/>
    {renameFeedback.status === "success" && renameFeedback.message ? <p className="visually-hidden" role="status">{renameFeedback.message ? t(renameFeedback.message, renameFeedback.values) : ""}</p> : null}
  </div>;
}
