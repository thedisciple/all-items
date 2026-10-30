"use client";

import { useEffect, useRef, useState, type ReactNode, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { PrivateImage } from "./private-image";
import { ArrowLeft, ArrowRight, X } from "lucide-react";
import { useI18n } from "@/i18n/provider";

export type PhotoNavigation = { index: number; total: number; disabled: boolean; select: (index: number) => void };
export function PhotoViewer({ src, alt, cover = false, action, navigation }: { src: string; alt: string; cover?: boolean; action?: ReactNode; navigation?: PhotoNavigation }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const imageButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const openedOnce = useRef(false);
  const swipe = useRef<{ x: number; y: number } | null>(null);
  const suppressClick = useRef(false);
  function browse(delta: number) { if (!navigation || navigation.disabled) return; const next=navigation.index+delta;if(next>=0&&next<navigation.total)navigation.select(next); }

  function trapDialogFocus(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (!open || event.defaultPrevented || event.key !== "Tab" || (event.target instanceof HTMLElement && event.target.closest('[role="dialog"]') !== event.currentTarget)) return;
    const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLElement>("button:not([disabled]),input:not([disabled]),select:not([disabled]),a[href]"));
    const first = buttons[0];
    const last = buttons.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }

  useEffect(() => {
    if (!open) {
      if (openedOnce.current) imageButtonRef.current?.focus();
      return;
    }
    openedOnce.current = true;
    closeButtonRef.current?.focus();
    const closeOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape" && !event.defaultPrevented) { event.preventDefault(); setOpen(false); }
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open]);

  return <div className={`photo-viewer${cover ? " collection-cover-viewer" : ""}${open ? " photo-viewer-open" : ""}`} role={open ? "dialog" : undefined} aria-modal={open || undefined} aria-label={open ? t("photoViewer") : undefined} onKeyDown={event=>{trapDialogFocus(event);if(navigation&&(event.key==="ArrowLeft"||event.key==="ArrowRight")){event.preventDefault();browse(event.key==="ArrowLeft"?-1:1);}}} onMouseDown={(event) => { if (open && event.target === event.currentTarget) setOpen(false); }}
    onPointerDown={event=>{suppressClick.current=false;if(event.pointerType==="touch"&&navigation&&event.target instanceof Element&&!event.target.closest(".photo-viewer-close"))swipe.current={x:event.clientX,y:event.clientY};}}
    onPointerCancel={()=>{swipe.current=null;}}
    onPointerUp={event=>{const start=swipe.current;swipe.current=null;if(!start)return;const dx=event.clientX-start.x,dy=event.clientY-start.y;if(Math.abs(dx)>45&&Math.abs(dx)>Math.abs(dy)*1.5){suppressClick.current=true;browse(dx>0?-1:1);}}}>
    <button ref={imageButtonRef} type="button" className="photo-viewer-image" aria-label={t("photoEnlarge")} aria-expanded={open} onClick={() => { if(suppressClick.current){suppressClick.current=false;return;}setOpen(true); }}>
      <PrivateImage variant={cover && !open ? "cover" : "detail"} className={cover ? "detail-photo collection-detail-cover" : "detail-photo"} src={src} alt={alt}/>
    </button>
    {navigation&&navigation.total>1?<>
      <button type="button" className="icon-button gallery-browse gallery-browse-previous" aria-label={t("galleryPrevious")} disabled={navigation.disabled||navigation.index===0} onClick={()=>{if(suppressClick.current){suppressClick.current=false;return;}browse(-1);}}><ArrowLeft size={18} aria-hidden="true"/></button>
      <button type="button" className="icon-button gallery-browse gallery-browse-next" aria-label={t("galleryNext")} disabled={navigation.disabled||navigation.index===navigation.total-1} onClick={()=>{if(suppressClick.current){suppressClick.current=false;return;}browse(1);}}><ArrowRight size={18} aria-hidden="true"/></button>
      <span className="gallery-counter" aria-live="polite">{t("galleryCounter",{number:navigation.index+1,total:navigation.total})}</span>
    </>:null}
    {open ? <button ref={closeButtonRef} type="button" className="photo-viewer-close icon-button" aria-label={t("close")} title={t("close")} onClick={() => setOpen(false)}><X size={20} aria-hidden="true"/></button> : null}
    {open && action ? <div className="cover-viewer-actions">{action}</div> : null}
  </div>;
}
