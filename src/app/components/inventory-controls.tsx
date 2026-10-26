"use client";

import { useActionState, useEffect, useRef, useState, startTransition, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, Settings, X } from "lucide-react";
import { createInventoryAction, renameInventoryAction, type InventoryFeedback } from "@/app/inventory-actions";
import { useInventory, InventoryField } from "./inventory-provider";
import { useI18n } from "@/i18n/provider";

const idle: InventoryFeedback = { status: "idle" };

export function CreateInventoryControl() {
  const { t } = useI18n();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [feedback, action, pending] = useActionState(createInventoryAction, idle);
  const trigger = useRef<HTMLButtonElement>(null);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { if (open) input.current?.focus(); }, [open]);
  useEffect(() => { if (feedback.status === "success" && feedback.inventoryId) { setOpen(false); setName(""); router.push(`/inventories/${feedback.inventoryId}`); } }, [feedback,router]);
  const close = () => { if (!pending) { setOpen(false); trigger.current?.focus(); } };
  function keys(event: KeyboardEvent<HTMLElement>) {
    if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); close(); }
    if (event.key !== "Tab") return;
    const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLElement>("button:not([disabled]),input:not([disabled])"));
    const first=buttons[0], last=buttons.at(-1);
    if (event.shiftKey && document.activeElement===first) { event.preventDefault(); last?.focus(); }
    if (!event.shiftKey && document.activeElement===last) { event.preventDefault(); first?.focus(); }
  }
  return <><button ref={trigger} className="quiet-button inventory-create-button" type="button" onClick={() => setOpen(true)}><Plus size={16}/>{t("inventoryCreate")}</button>{open ? <div className="photo-source-overlay add-dialog-overlay"><section role="dialog" aria-modal="true" aria-labelledby="inventory-create-title" className="photo-source-dialog" onKeyDown={keys}>
    <div className="dialog-heading"><h2 id="inventory-create-title">{t("inventoryCreate")}</h2><button type="button" className="icon-button" aria-label={t("close")} disabled={pending} onClick={close}><X size={18}/></button></div>
    <form aria-busy={pending} onSubmit={event => { event.preventDefault(); const data = new FormData(event.currentTarget); startTransition(() => action(data)); }}>
      <label className="field"><span>{t("inventoryName")}</span><input ref={input} name="name" required maxLength={120} value={name} onChange={event => setName(event.target.value)}/></label>
      {feedback.code ? <p className="inline-status error-status" role="alert">{t(feedback.code)}</p> : null}
      <div className="dialog-actions"><button className="add-button" disabled={pending || !name.trim()}>{pending ? t("savingChanges") : t("inventoryCreate")}</button><button className="quiet-button" type="button" disabled={pending} onClick={close}>{t("cancel")}</button></div>
    </form>
  </section></div> : null}</>;
}

export function InventorySwitcher() {
  const { t }=useI18n(); const { inventory,inventories,base }=useInventory(); const router=useRouter();
  return <div className="inventory-switcher"><label className="field"><span className="visually-hidden">{t("inventoryCurrent")}</span><select aria-label={t("inventoryCurrent")} value={inventory.workspaceId} onChange={event => router.push(`/inventories/${event.target.value}`)}>{inventories.map(entry => <option key={entry.workspaceId} value={entry.workspaceId}>{entry.name}</option>)}</select></label><div className="inventory-switcher-actions"><CreateInventoryControl/><Link className="icon-button" href={`${base}/settings`} aria-label={t("inventoryManage")} title={t("inventoryManage")}><Settings size={17}/></Link></div></div>;
}

export function RenameInventoryControl() {
  const { inventory }=useInventory(); const {t}=useI18n();
  const [name,setName]=useState(inventory.name); const [feedback,action,pending]=useActionState(renameInventoryAction,idle);
  return <form className="detail-panel" aria-busy={pending} onSubmit={event=>{event.preventDefault();const data=new FormData(event.currentTarget);startTransition(()=>action(data));}}><InventoryField/><label className="field"><span>{t("inventoryName")}</span><input name="name" required maxLength={120} value={name} onChange={event=>setName(event.target.value)}/></label><div className="form-action-row"><button className="add-button" disabled={pending || !name.trim() || name===inventory.name}>{pending?t("savingChanges"):t("saveChanges")}</button></div>{feedback.code?<p className="inline-status error-status" role="alert">{t(feedback.code)}</p>:null}</form>;
}
