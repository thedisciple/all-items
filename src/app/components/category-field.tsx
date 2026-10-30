"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, X } from "lucide-react";
import { canonicalCategories, categories, categoryEmoji, categoryKeyForStoredValue, categoryMessageKey } from "@/items/categories";
import { useI18n } from "@/i18n/provider";
import { useInventory } from "./inventory-provider";
import type { Presentation } from "@/items/inventory-presentation";

export function CategoryField({ values, onValueChange, presentations, onPresentationChange }: { values: string[]; onValueChange: (values: string[]) => void; presentations: Presentation[]; onPresentationChange: (values: Presentation[]) => void }) {
  const { t }=useI18n();
  const { presentation } = useInventory();
  const emojiMap = Object.fromEntries([...presentation.categories, ...presentations].map(entry => [entry.category, entry.emoji]));
  const [custom,setCustom]=useState("");
  const [emoji,setEmoji]=useState("");
  const [open,setOpen]=useState(false);
  const [host,setHost]=useState<HTMLElement|null>(null);
  const [position,setPosition]=useState({left:0,top:0,width:0,maxHeight:0});
  const root=useRef<HTMLDivElement>(null),box=useRef<HTMLDivElement>(null),trigger=useRef<HTMLButtonElement>(null),popup=useRef<HTMLDivElement>(null);
  const keyboardOpen=useRef(false);
  const popupId=useId();
  const systemMatch = categoryKeyForStoredValue(custom.trim());
  const label=(value:string)=>{const key=categoryMessageKey(value);return key?t(key):value;};
  const matches=categories.filter(value=>`${label(value)} ${value}`.toLocaleLowerCase().includes(custom.trim().toLocaleLowerCase()));

  useLayoutEffect(()=>{
    if(!open)return;
    setHost(root.current?.closest<HTMLElement>('[role="dialog"]') ?? document.body);
    function reposition(){
      const rect=box.current?.getBoundingClientRect();if(!rect)return;
      const margin=8,width=Math.min(Math.max(rect.width,260),window.innerWidth-margin*2);
      const below=Math.max(0,window.innerHeight-rect.bottom-margin-6),above=Math.max(0,rect.top-margin-6);
      const flip=below<200&&above>below,maxHeight=Math.max(80,Math.min(290,flip?above:below));
      const left=Math.max(margin,Math.min(rect.left,window.innerWidth-width-margin));
      const top=flip?Math.max(margin,rect.top-maxHeight-6):Math.min(window.innerHeight-maxHeight-margin,rect.bottom+6);
      setPosition({left,top,width,maxHeight});
    }
    reposition();window.addEventListener("resize",reposition);window.addEventListener("scroll",reposition,true);
    return()=>{window.removeEventListener("resize",reposition);window.removeEventListener("scroll",reposition,true);};
  },[open]);
  useEffect(()=>{
    if(!open)return;
    const dismiss=(event:PointerEvent)=>{const target=event.target as Node;if(!root.current?.contains(target)&&!popup.current?.contains(target))setOpen(false);};
    document.addEventListener("pointerdown",dismiss);
    return()=>document.removeEventListener("pointerdown",dismiss);
  },[open]);
  useEffect(()=>{if(open&&host&&keyboardOpen.current){keyboardOpen.current=false;popup.current?.querySelector<HTMLInputElement>('input[type="checkbox"]:not(:disabled)')?.focus();}},[open,host]);

  function addCustom(){
    if(!custom.trim()||values.length>=20)return;
    if (emoji.trim() && systemMatch) return;
    const category=custom.trim();
    if (emoji.trim() && !categoryKeyForStoredValue(category)) onPresentationChange([...presentations.filter(entry => entry.category !== category), { category, emoji: emoji.trim() }]);
    onValueChange(canonicalCategories([...values,category]));setCustom("");setEmoji("");
  }
  function handleKeys(event:React.KeyboardEvent){
    if(event.key==="Escape"&&open){event.preventDefault();event.stopPropagation();setOpen(false);trigger.current?.focus();return;}
    if(event.key==="Backspace"&&event.target===trigger.current&&values.length){event.preventDefault();onValueChange(values.slice(0,-1));return;}
    const target=event.target;
    if(!(target instanceof HTMLInputElement)||target.type!=="checkbox")return;
    if(event.key==="Enter"){event.preventDefault();target.click();return;}
    if(event.key!=="ArrowDown"&&event.key!=="ArrowUp"&&event.key!=="Home"&&event.key!=="End")return;
    const options=Array.from(popup.current?.querySelectorAll<HTMLInputElement>('input[type="checkbox"]:not(:disabled)')??[]);
    if(!options.length)return;
    event.preventDefault();const index=options.indexOf(target),next=event.key==="Home"?0:event.key==="End"?options.length-1:(index+(event.key==="ArrowDown"?1:options.length-1))%options.length;options[next]?.focus();
  }

  const panel=open&&host?createPortal(<div ref={popup} id={popupId} className="category-picker category-popover" role="group" aria-label={t("itemCategories")} style={{position:"fixed",...position}}>
    <div className="custom-category-row"><input aria-label={t("customCategory")} maxLength={80} value={custom} placeholder={t("customCategoryPlaceholder")} onChange={event=>setCustom(event.target.value)} onKeyDown={event=>{if(event.key==="Enter"){event.preventDefault();if (!emoji || /\p{Extended_Pictographic}|\p{Regional_Indicator}/u.test(emoji)) addCustom();}}}/><input aria-label={t("customCategoryEmoji")} maxLength={32} value={emoji} onChange={event=>setEmoji(event.target.value)} placeholder="😀"/><button className="quiet-button" type="button" disabled={!custom.trim()||values.length>=20||Boolean(emoji && (!/\p{Extended_Pictographic}|\p{Regional_Indicator}/u.test(emoji)||systemMatch))} onClick={addCustom}>{t("addCategory")}</button></div>
    {systemMatch ? <p className="category-emoji-hint">{t("categoryMatchesSystem")}</p> : emoji ? <p className="category-emoji-hint">{t("customEmojiScope")}</p> : null}
    <div className="category-options" role="group" aria-label={t("itemCategories")}>{matches.map(value=><label key={value}><input type="checkbox" checked={values.includes(value)} disabled={!values.includes(value)&&values.length>=20} onChange={event=>onValueChange(event.target.checked?[...values,value]:values.filter(entry=>entry!==value))}/><span aria-hidden="true">{categoryEmoji[value]}</span>{label(value)}</label>)}</div>
  </div>,host):null;

  return <div ref={root} className="field category-field" onKeyDown={handleKeys}>
    <span>{t("itemCategories")}</span>
    <div ref={box} className="category-field-box">
      <div className="category-selection">{values.map(value=>{const key=categoryKeyForStoredValue(value), icon=key ? categoryEmoji[key] : emojiMap[value];return <span className="category-chip" title={label(value)} key={value}>{icon ? <span aria-hidden="true">{icon}</span> : null}<span className="category-chip-label">{label(value)}</span><button type="button" className="icon-button" aria-label={t("removeCategory",{category:label(value)})} onClick={()=>onValueChange(values.filter(entry=>entry!==value))}><X size={13} aria-hidden="true"/></button><input type="hidden" name="categories" value={value}/></span>;})}<input type="hidden" name="categoryPresentation" value={JSON.stringify(presentations.filter(entry=>values.includes(entry.category)))}/></div>
      <button ref={trigger} className="category-trigger" type="button" aria-label={t("selectCategories")} aria-expanded={open} aria-controls={open?popupId:undefined} onClick={()=>setOpen(value=>!value)} onKeyDown={event=>{if(event.key==="ArrowDown"&&!open){event.preventDefault();keyboardOpen.current=true;setOpen(true);}}}><span className={values.length?"visually-hidden":undefined}>{t("selectCategories")}</span><ChevronDown size={16} aria-hidden="true"/></button>
    </div>
    {panel}
  </div>;
}
