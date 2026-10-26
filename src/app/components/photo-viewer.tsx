"use client";

import { useEffect, useRef, useState, type ReactNode, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { PrivateImage } from "./private-image";
import { X } from "lucide-react";
import { useI18n } from "@/i18n/provider";

export function PhotoViewer({ src, alt, cover = false, action }: { src: string; alt: string; cover?: boolean; action?: ReactNode }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const imageButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const openedOnce = useRef(false);

  function trapDialogFocus(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (!open || event.key !== "Tab") return;
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

  return <div className={`photo-viewer${cover ? " collection-cover-viewer" : ""}${open ? " photo-viewer-open" : ""}`} role={open ? "dialog" : undefined} aria-modal={open || undefined} aria-label={open ? t("photoViewer") : undefined} onKeyDown={trapDialogFocus} onMouseDown={(event) => { if (open && event.target === event.currentTarget) setOpen(false); }}>
    <button ref={imageButtonRef} type="button" className="photo-viewer-image" aria-label={t("photoEnlarge")} aria-expanded={open} onClick={() => setOpen(true)}>
      <PrivateImage variant={cover && !open ? "cover" : "detail"} className={cover ? "detail-photo collection-detail-cover" : "detail-photo"} src={src} alt={alt}/>
    </button>
    {open ? <button ref={closeButtonRef} type="button" className="photo-viewer-close icon-button" aria-label={t("close")} title={t("close")} onClick={() => setOpen(false)}><X size={20} aria-hidden="true"/></button> : null}
    {open && action ? <div className="cover-viewer-actions">{action}</div> : null}
  </div>;
}
