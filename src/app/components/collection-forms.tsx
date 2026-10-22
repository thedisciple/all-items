"use client";

import { useActionState, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { createCollectionAction, deleteCollectionAction, renameCollectionAction, type ActionFeedback } from "@/app/actions";
import { FormSubmitButton } from "./form-submit-button";
import { DestructiveConfirmation } from "./destructive-confirmation";
import { useI18n } from "@/i18n/provider";

const idle: ActionFeedback = { status: "idle", message: "" };

function handleDialogKeys(event: KeyboardEvent<HTMLElement>, close: () => void) {
  if (event.key === "Escape") { close(); return; }
  if (event.key !== "Tab") return;
  const focusable = Array.from(event.currentTarget.querySelectorAll<HTMLElement>("button:not([disabled]),input:not([disabled]):not([type='hidden']):not(.visually-hidden),select:not([disabled]),a[href]"));
  const first = focusable[0]; const last = focusable.at(-1);
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
}

export function CreateCollectionForm() {
  const { t } = useI18n();
  const [feedback, action] = useActionState(createCollectionAction, idle);
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("");
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);
  const router = useRouter();
  useEffect(() => {
    if (feedback.status === "success" && feedback.collectionId) {
      setOpen(false); setName(""); setIcon(""); router.push(`/collections/${feedback.collectionId}`);
    }
  }, [feedback, router]);
  useEffect(() => { if (open) { wasOpen.current = true; dialogRef.current?.querySelector<HTMLElement>("input")?.focus(); } else if (wasOpen.current) { wasOpen.current = false; triggerRef.current?.focus(); } }, [open]);
  return <>
    <button ref={triggerRef} type="button" className="add-button collection-create-trigger" onClick={() => setOpen(true)}>{t("collectionCreateOpen")}</button>
    {open ? <div className="photo-source-overlay add-dialog-overlay" role="presentation"><section ref={dialogRef} className="photo-source-dialog collection-create-dialog" role="dialog" aria-modal="true" aria-labelledby="collection-create-title" onKeyDown={(event) => handleDialogKeys(event, () => setOpen(false))}>
      <div className="dialog-heading"><h3 id="collection-create-title">{t("collectionCreateOpen")}</h3><button type="button" className="icon-button" aria-label={t("close")} onClick={() => setOpen(false)}>×</button></div>
      <form action={action} className="collection-create-form">
        <label className="field"><span>{t("collectionName")}</span><input name="name" value={name} maxLength={120} required placeholder={t("collectionNamePlaceholder")} onChange={(event) => setName(event.target.value)}/></label>
        <label className="field"><span>{t("collectionIcon")}</span><select name="icon" value={icon} onChange={(event) => setIcon(event.target.value)}><option value="">{t("collectionIconNone")}</option><option value="🤖">🤖 {t("collectionIconRobotics")}</option><option value="🪴">🪴 {t("collectionIconPlants")}</option><option value="🔧">🔧 {t("collectionIconWorkshop")}</option><option value="📷">📷 {t("collectionIconCameras")}</option><option value="🔌">🔌 {t("categoryElectronics")}</option><option value="💻">💻 {t("categoryComputers")}</option><option value="🏺">🏺 {t("categoryAntiques")}</option><option value="📚">📚 {t("categoryBooksHobbies")}</option><option value="⚽">⚽ {t("categorySports")}</option><option value="📦">📦 {t("categoryOther")}</option></select></label>
        {feedback.status === "error" && feedback.message ? <p className="inline-status error-status" role="alert">{feedback.message}</p> : null}
        <div className="dialog-actions"><FormSubmitButton className="add-button" pendingLabel={t("collectionCreating")}>{t("collectionCreate")}</FormSubmitButton><button type="button" className="text-button" onClick={() => setOpen(false)}>{t("cancel")}</button></div>
      </form>
    </section></div> : null}
  </>;
}

export function CollectionManageForms({ id, name, icon }: { id: string; name: string; icon: string | null }) {
  const { t } = useI18n();
  const [renameFeedback, renameAction] = useActionState(renameCollectionAction, idle);
  const [draftName, setDraftName] = useState(name);
  const [draftIcon, setDraftIcon] = useState(icon ?? "");
  const [editing, setEditing] = useState(false);
  const router = useRouter();
  const nameInput = useRef<HTMLInputElement>(null);
  useEffect(() => { if (renameFeedback.status === "success") { setEditing(false); router.refresh(); } }, [renameFeedback, router]);
  useEffect(() => { if (editing) { nameInput.current?.focus(); nameInput.current?.select(); } }, [editing]);
  return <div className="collection-manage-forms">
    <div className="collection-rename-panel">
      {!editing ? <button type="button" className="text-button collection-edit-trigger" onClick={() => { setDraftName(name); setDraftIcon(icon ?? ""); setEditing(true); }}>{t("collectionEdit")}</button> : <form action={renameAction} className="collection-rename-form" onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); setEditing(false); } }}>
        <input type="hidden" name="id" value={id}/>
        <label className="field"><span>{t("collectionRenameTitle")}</span><input ref={nameInput} name="name" value={draftName} maxLength={120} required onChange={(event) => setDraftName(event.target.value)}/></label>
        <label className="field"><span>{t("collectionIcon")}</span><select name="icon" value={draftIcon} onChange={(event) => setDraftIcon(event.target.value)}><option value="">{t("collectionIconNone")}</option>{collectionIconOptions(t).map(([value, label]) => <option key={value} value={value}>{value} {label}</option>)}</select></label>
        {renameFeedback.status === "error" && renameFeedback.message ? <p className="inline-status error-status" role="alert">{renameFeedback.message}</p> : null}
        <div className="dialog-actions"><FormSubmitButton disabled={draftName.trim() === name && draftIcon === (icon ?? "")} pendingLabel={t("savingChanges")}>{t("collectionRename")}</FormSubmitButton><button type="button" className="text-button" onClick={() => setEditing(false)}>{t("cancel")}</button></div>
      </form>}
    </div>
    <DestructiveConfirmation action={deleteCollectionAction} label={t("collectionDelete")} description={`${t("collectionDeleteWarning")} «${name}»`} fields={{ id }}/>
    {renameFeedback.status === "success" && renameFeedback.message ? <p className="visually-hidden" role="status">{renameFeedback.message}</p> : null}
  </div>;
}

function collectionIconOptions(t: (key: "collectionIconRobotics" | "collectionIconPlants" | "collectionIconWorkshop" | "collectionIconCameras" | "categoryElectronics" | "categoryComputers" | "categoryAntiques" | "categoryBooksHobbies" | "categorySports" | "categoryOther") => string) {
  return [["🤖", t("collectionIconRobotics")], ["🪴", t("collectionIconPlants")], ["🔧", t("collectionIconWorkshop")], ["📷", t("collectionIconCameras")], ["🔌", t("categoryElectronics")], ["💻", t("categoryComputers")], ["🏺", t("categoryAntiques")], ["📚", t("categoryBooksHobbies")], ["⚽", t("categorySports")], ["📦", t("categoryOther")]] as const;
}
