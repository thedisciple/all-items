"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { Trash2, X } from "lucide-react";
import { useFormStatus } from "react-dom";
import { useI18n } from "@/i18n/provider";

type FormAction = (formData: FormData) => void | Promise<void>;

function ConfirmButton({ label, pendingLabel, onPendingChange }: { label: string; pendingLabel: string; onPendingChange: (pending: boolean) => void }) {
  const { pending } = useFormStatus();
  useEffect(() => onPendingChange(pending), [onPendingChange, pending]);
  return <button type="submit" className="delete-button" disabled={pending}><Trash2 size={16} aria-hidden="true"/><span>{pending ? pendingLabel : label}</span></button>;
}

export function DestructiveConfirmation({ action, label, description, fields, children }: {
  action: FormAction;
  label: string;
  description: string;
  fields: Record<string, string>;
  children?: ReactNode;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const didOpen = useRef(false);

  useEffect(() => {
    if (open) {
      didOpen.current = true;
      dialogRef.current?.querySelector<HTMLElement>("button")?.focus();
    } else if (didOpen.current) {
      didOpen.current = false;
      triggerRef.current?.focus();
    }
  }, [open]);

  function onKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === "Escape" && !pending) { event.preventDefault(); setOpen(false); return; }
    if (event.key !== "Tab") return;
    const focusable = Array.from(event.currentTarget.querySelectorAll<HTMLElement>("button:not([disabled])"));
    const first = focusable[0]; const last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }

  return <>
    <button ref={triggerRef} type="button" className="delete-button" onClick={() => setOpen(true)}><Trash2 size={16} aria-hidden="true"/><span>{label}</span></button>
    {open ? <div className="photo-source-overlay destructive-overlay" role="presentation" onMouseDown={(event) => { if (!pending && event.target === event.currentTarget) setOpen(false); }}>
      <section ref={dialogRef} className="photo-source-dialog destructive-dialog" role="alertdialog" aria-modal="true" aria-labelledby="destructive-title" aria-describedby="destructive-description" onKeyDown={onKeyDown}>
        <div className="dialog-heading"><h2 id="destructive-title">{label}</h2><button type="button" className="icon-button" aria-label={t("close")} disabled={pending} onClick={() => setOpen(false)}><X size={18} aria-hidden="true"/></button></div>
        <p id="destructive-description">{description}</p>
        {children}
        <form action={action} className="destructive-form">
          {Object.entries(fields).map(([name, value]) => <input key={name} type="hidden" name={name} value={value}/>)}
          <input type="hidden" name="confirm" value="on"/>
          <div className="dialog-actions"><button type="button" className="text-button" disabled={pending} onClick={() => setOpen(false)}>{t("cancel")}</button><ConfirmButton label={label} pendingLabel={t("deleting")} onPendingChange={setPending}/></div>
        </form>
      </section>
    </div> : null}
  </>;
}
