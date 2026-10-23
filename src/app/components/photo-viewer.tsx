"use client";

import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { PrivateImage } from "./private-image";
import { X } from "lucide-react";
import { useI18n } from "@/i18n/provider";

export function PhotoViewer({ src, alt }: { src: string; alt: string }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const imageButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const openedOnce = useRef(false);

  function trapDialogFocus(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (!open || event.key !== "Tab") return;
    const first = imageButtonRef.current;
    const last = closeButtonRef.current;
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
      if (event.key === "Escape") { event.preventDefault(); setOpen(false); }
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open]);

  return <div className={`photo-viewer${open ? " photo-viewer-open" : ""}`} role={open ? "dialog" : undefined} aria-modal={open || undefined} aria-label={open ? t("photoViewer") : undefined} onKeyDown={trapDialogFocus} onMouseDown={(event) => { if (open && event.target === event.currentTarget) setOpen(false); }}>
    <button ref={imageButtonRef} type="button" className="photo-viewer-image" aria-label={t("photoEnlarge")} aria-expanded={open} onClick={() => setOpen(true)}>
      <PrivateImage variant="detail" className="detail-photo" src={src} alt={alt}/>
    </button>
    {open ? <button ref={closeButtonRef} type="button" className="photo-viewer-close icon-button" aria-label={t("close")} title={t("close")} onClick={() => setOpen(false)}><X size={20} aria-hidden="true"/></button> : null}
  </div>;
}
