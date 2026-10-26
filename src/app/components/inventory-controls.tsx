"use client";

import { useActionState, useEffect, useRef, useState, startTransition, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, Settings, Trash2, X } from "lucide-react";
import { createInventoryAction, deleteInventoryAction, renameInventoryAction, type InventoryFeedback } from "@/app/inventory-actions";
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

export function DeleteInventoryControl({counts}:{counts:{items:number;collections:number}}) {
  const {inventory}=useInventory();const {t}=useI18n();
  const [open,setOpen]=useState(false),[confirmation,setConfirmation]=useState("");
  const [feedback,action,pending]=useActionState(deleteInventoryAction,idle);
  const trigger=useRef<HTMLButtonElement>(null),dialog=useRef<HTMLElement>(null);
  const populated=counts.items>0||counts.collections>0;
  useEffect(()=>{if(open)dialog.current?.querySelector<HTMLElement>(populated?"input[name=confirmation]":"button")?.focus();},[open,populated]);
  const close=()=>{if(!pending){setOpen(false);trigger.current?.focus();}};
  function keys(event:KeyboardEvent<HTMLElement>) {
    if(event.key==="Escape"){event.preventDefault();close();return;}
    if(event.key!=="Tab")return;
    const controls=Array.from(event.currentTarget.querySelectorAll<HTMLElement>("button:not([disabled]),input:not([disabled]):not([type=hidden])")),first=controls[0],last=controls.at(-1);
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
    else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
  }
  return <><button ref={trigger} type="button" className="delete-button" onClick={()=>setOpen(true)}><Trash2 size={16}/>{t("inventoryDelete")}</button>{open?<div className="photo-source-overlay destructive-overlay"><section ref={dialog} className="photo-source-dialog destructive-dialog" role="alertdialog" aria-modal="true" aria-labelledby="inventory-delete-title" aria-describedby="inventory-delete-description" onKeyDown={keys}>
    <div className="dialog-heading"><h2 id="inventory-delete-title">{t("inventoryDelete")}</h2><button className="icon-button" type="button" aria-label={t("close")} disabled={pending} onClick={close}><X size={18}/></button></div>
    <p id="inventory-delete-description"><strong>{inventory.name}</strong></p><p>{t("inventoryDeleteCounts",counts)}</p>
    <form aria-busy={pending} onSubmit={event=>{event.preventDefault();if(!pending){const data=new FormData(event.currentTarget);startTransition(()=>action(data));}}}><InventoryField/><input type="hidden" name="confirm" value="on"/>
      {populated?<label className="field"><span>{t("inventoryDeleteName")}</span><input name="confirmation" required maxLength={120} disabled={pending} value={confirmation} onChange={event=>setConfirmation(event.target.value)}/></label>:<input type="hidden" name="confirmation" value=""/>}
      {feedback.code?<p className="inline-status error-status" role="alert">{t(feedback.code)}</p>:null}
      <div className="dialog-actions"><button className="quiet-button" type="button" disabled={pending} onClick={close}>{t("cancel")}</button><button className="delete-button" disabled={pending||populated&&confirmation!==inventory.name}><Trash2 size={16}/>{pending?t("deleting"):t("inventoryDelete")}</button></div>
    </form>
  </section></div>:null}</>;
}
