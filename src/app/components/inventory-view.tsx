"use client";
import {createContext,useContext,useEffect,useLayoutEffect,useRef,useState,type ReactNode} from "react";
import {SlidersHorizontal} from "lucide-react";
import {useI18n} from "@/i18n/provider";

const defaults={modelBrand:false,categories:true,quantity:true,location:false,status:false,added:true};
type Options=typeof defaults;
type View={options:Options;set:(key:keyof Options,value:boolean)=>void;reset:()=>void;storageError:boolean};
const Context=createContext<View|null>(null);
export function InventoryViewProvider({inventoryId,children}:{inventoryId:string;children:ReactNode}){
  const [options,setOptions]=useState<Options>(defaults),[ready,setReady]=useState(false),[storageError,setStorageError]=useState(false);
  const key=`all-items:view:${inventoryId}`;
  useLayoutEffect(()=>{
    function read(){try{const raw=localStorage.getItem(key);if(!raw){setOptions(defaults);return;}const value:unknown=JSON.parse(raw);if(!value||typeof value!=="object"||Array.isArray(value))throw new Error("Invalid view settings");const record=value as Record<string,unknown>;setOptions(Object.fromEntries(Object.entries(defaults).map(([name,fallback])=>[name,typeof record[name]==="boolean"?record[name]:fallback])) as Options);setStorageError(false);}catch{setOptions(defaults);setStorageError(true);}}
    read();setReady(true);const listener=(event:StorageEvent)=>{if(event.key===key)read();};window.addEventListener("storage",listener);return()=>window.removeEventListener("storage",listener);
  },[key]);
  function save(next:Options){setOptions(next);try{localStorage.setItem(key,JSON.stringify(next));setStorageError(false);}catch{setStorageError(true);}}
  return <Context.Provider value={{options,set:(name,value)=>save({...options,[name]:value}),reset:()=>save(defaults),storageError}}><div className="inventory-view" data-view-ready={ready} data-view-model={options.modelBrand} data-view-categories={options.categories} data-view-quantity={options.quantity} data-view-location={options.location} data-view-status={options.status} data-view-added={options.added}>{children}</div></Context.Provider>;
}
export function InventoryViewOptions(){
  const view=useContext(Context),{t}=useI18n();const [open,setOpen]=useState(false);const root=useRef<HTMLDivElement>(null),trigger=useRef<HTMLButtonElement>(null),panel=useRef<HTMLDivElement>(null);const [shift,setShift]=useState(0);
  useEffect(()=>{if(!open)return;function close(event:MouseEvent){if(event.target instanceof Node&&!root.current?.contains(event.target))setOpen(false);}document.addEventListener("mousedown",close);return()=>document.removeEventListener("mousedown",close);},[open]);
  useLayoutEffect(()=>{if(!open)return;function fit(){const element=panel.current;if(!element)return;const rect=element.getBoundingClientRect();const unshifted=rect.left-shift;setShift(Math.max(8-unshifted,Math.min(0,window.innerWidth-8-(unshifted+rect.width))));}fit();window.addEventListener("resize",fit);return()=>window.removeEventListener("resize",fit);},[open,shift]);
  if(!view)return null;
  const labels:Record<keyof Options,Parameters<typeof t>[0]>={modelBrand:"viewModelBrand",categories:"category",quantity:"quantity",location:"locationName",status:"identificationStatus",added:"dateAdded"};
  return <div ref={root} className="view-options" onKeyDown={event=>{if(event.key==="Escape"&&open){event.preventDefault();setOpen(false);trigger.current?.focus();}}}>
    <button ref={trigger} type="button" className="quiet-button view-options-trigger" aria-label={t("viewOptions")} title={t("viewOptions")} aria-expanded={open} aria-controls="inventory-view-options" onClick={()=>setOpen(!open)}><SlidersHorizontal size={17} aria-hidden="true"/></button>
    {open?<div ref={panel} style={{transform:`translateX(${shift}px)`}} id="inventory-view-options" className="view-options-panel" role="group" aria-label={t("viewOptions")}>
      {Object.entries(labels).map(([name,label])=><label key={name}><input type="checkbox" checked={view.options[name as keyof Options]} onChange={event=>view.set(name as keyof Options,event.target.checked)}/><span>{t(label)}</span></label>)}
      <button type="button" className="quiet-button" onClick={view.reset}>{t("viewReset")}</button>{view.storageError?<p className="form-error" role="alert">{t("viewStorageError")}</p>:null}
    </div>:null}
  </div>;
}
