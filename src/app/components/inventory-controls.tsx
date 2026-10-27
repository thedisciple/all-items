"use client";

import { useActionState, useEffect, useRef, useState, startTransition, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Check, ChevronDown, Plus, Settings, Trash2, X } from "lucide-react";
import { createInventoryAction, deleteInventoryAction, renameInventoryAction, saveInventorySortAction, type InventoryFeedback } from "@/app/inventory-actions";
import { useInventory, InventoryField } from "./inventory-provider";
import { useI18n } from "@/i18n/provider";

const idle: InventoryFeedback = { status: "idle" };

export function CreateInventoryControl({ menuItem = false }: { menuItem?: boolean }) {
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
  return <><button ref={trigger} role={menuItem ? "menuitem" : undefined} className={menuItem ? "inventory-menu-create inventory-create-button" : "quiet-button inventory-create-button"} type="button" onClick={() => setOpen(true)}><Plus size={16}/>{t("inventoryCreate")}</button>{open ? <div className="photo-source-overlay add-dialog-overlay"><section role="dialog" aria-modal="true" aria-labelledby="inventory-create-title" className="photo-source-dialog" onKeyDown={keys}>
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
  const [open,setOpen]=useState(false);
  const root=useRef<HTMLDivElement>(null),trigger=useRef<HTMLButtonElement>(null),menu=useRef<HTMLDivElement>(null);
  const keyboardOpen=useRef(false);
  useEffect(()=>{
    if(!open)return;
    if(keyboardOpen.current){keyboardOpen.current=false;menu.current?.querySelector<HTMLButtonElement>('[role="menuitemradio"][aria-checked="true"]')?.focus();}
    const dismiss=(event:PointerEvent)=>{if(!root.current?.contains(event.target as Node))setOpen(false);};
    document.addEventListener("pointerdown",dismiss);
    return()=>document.removeEventListener("pointerdown",dismiss);
  },[open]);
  const duplicates=(name:string)=>inventories.filter(entry=>entry.name.trim().toLocaleLowerCase()===name.trim().toLocaleLowerCase()).length>1;
  return <div className="inventory-switcher" ref={root}>
    <button ref={trigger} className="inventory-menu-trigger" type="button" aria-label={`${t("inventoryCurrent")}: ${inventory.name}`} aria-haspopup="menu" aria-expanded={open} onClick={()=>setOpen(value=>!value)} onKeyDown={event=>{if(event.key==="ArrowDown"){event.preventDefault();if(open)menu.current?.querySelector<HTMLButtonElement>('[role="menuitemradio"][aria-checked="true"]')?.focus();else{keyboardOpen.current=true;setOpen(true);}}}}><span>{inventory.name}</span><ChevronDown size={16} aria-hidden="true"/></button>
    <Link className="icon-button inventory-settings-link" href={`${base}/settings`} aria-label={t("inventoryManage")} title={t("inventoryManage")}><Settings size={17} aria-hidden="true"/></Link>
    {open?<div ref={menu} className="inventory-menu" role="menu" aria-label={t("inventoryCurrent")} onKeyDown={event=>{
      if(event.key==="Escape"){event.preventDefault();event.stopPropagation();setOpen(false);trigger.current?.focus();return;}
      if(event.key!=="ArrowDown"&&event.key!=="ArrowUp"&&event.key!=="Home"&&event.key!=="End")return;
      event.preventDefault();const entries=Array.from(menu.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"],[role="menuitemradio"]')??[]);
      const index=entries.indexOf(document.activeElement as HTMLButtonElement);
      const next=event.key==="Home"?0:event.key==="End"?entries.length-1:(index+(event.key==="ArrowDown"?1:entries.length-1))%entries.length;
      entries[next]?.focus();
    }}>
      {inventories.map(entry=><button type="button" role="menuitemradio" aria-checked={entry.workspaceId===inventory.workspaceId} key={entry.workspaceId} onClick={()=>{setOpen(false);router.push(`/inventories/${entry.workspaceId}`);}}><span>{entry.name}{duplicates(entry.name)?` · ${entry.workspaceId.slice(0,8)}`:""}</span>{entry.workspaceId===inventory.workspaceId?<Check size={15} aria-hidden="true"/>:null}</button>)}
      <CreateInventoryControl menuItem/>
    </div>:null}
  </div>;
}

export function RenameInventoryControl() {
  const { inventory }=useInventory(); const {t}=useI18n();
  const [name,setName]=useState(inventory.name); const [feedback,action,pending]=useActionState(renameInventoryAction,idle);
  return <form className="detail-panel" aria-busy={pending} onSubmit={event=>{event.preventDefault();const data=new FormData(event.currentTarget);startTransition(()=>action(data));}}><InventoryField/><label className="field"><span>{t("inventoryName")}</span><input name="name" required maxLength={120} value={name} onChange={event=>setName(event.target.value)}/></label><div className="form-action-row"><button className="add-button" disabled={pending || !name.trim() || name===inventory.name}>{pending?t("savingChanges"):t("saveChanges")}</button></div>{feedback.code?<p className="inline-status error-status" role="alert">{t(feedback.code)}</p>:null}</form>;
}

export function InventorySortControl() {
  const { presentation } = useInventory(); const { t } = useI18n();
  const [sort, setSort] = useState(presentation.preferences.sort);
  const [feedback, action, pending] = useActionState(saveInventorySortAction, idle);
  const router = useRouter();
  useEffect(() => { if (feedback.status === "success") router.refresh(); }, [feedback, router]);
  return <form className="detail-panel" aria-busy={pending} onSubmit={event => { event.preventDefault(); const data = new FormData(event.currentTarget); startTransition(() => action(data)); }}><InventoryField/>
    <label className="field"><span>{t("defaultSort")}</span><select name="sort" value={sort} onChange={event => setSort(event.target.value as typeof sort)}><option value="date">{t("sortNewest")}</option><option value="name">{t("sortName")}</option><option value="quantity">{t("sortQuantity")}</option></select></label>
    <div className="form-action-row"><button className="add-button" disabled={pending || sort === presentation.preferences.sort}>{pending ? t("savingChanges") : t("saveChanges")}</button></div>
    {feedback.code ? <p className={feedback.status === "error" ? "inline-status error-status" : "inline-status"} role={feedback.status === "error" ? "alert" : "status"}>{t(feedback.code)}</p> : null}
  </form>;
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
