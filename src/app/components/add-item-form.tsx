"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Plus } from "lucide-react";
import { addItemAction, type ActionFeedback } from "@/app/actions";
import { PhotoAcquisition } from "./photo-acquisition";
import { FormSubmitButton } from "./form-submit-button";
import { CategoryField } from "./category-field";
import { useI18n } from "@/i18n/provider";

const idle: ActionFeedback = { status: "idle", message: "" };
type Draft = { name: string; model: string; brand: string; category: string; originalMarking: string; description: string; notes: string };

export function AddItemForm() {
  const { t } = useI18n();
  const [feedback, action] = useActionState(addItemAction, idle);
  const [draft, setDraft] = useState<Draft>({ name: "", model: "", brand: "", category: "", originalMarking: "", description: "", notes: "" });
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const update = (key: keyof Draft) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setDraft((current) => ({ ...current, [key]: event.target.value }));

  useEffect(() => {
    if (!open) return;
    dialogRef.current?.querySelector<HTMLElement>("button:not([disabled]),input:not([disabled])")?.focus();
  }, [open]);

  return <>
    <button ref={triggerRef} type="button" className="add-button add-dialog-trigger" onClick={() => setOpen(true)}><Plus size={17} aria-hidden="true"/><span>{t("addItem")}</span></button>
    {open ? <div className="photo-source-overlay add-dialog-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) { setOpen(false); triggerRef.current?.focus(); } }}>
      <section ref={dialogRef} className="photo-source-dialog add-item-dialog" role="dialog" aria-modal="true" aria-labelledby="add-item-title" onKeyDown={(event) => {
        const target = event.target;
        if (target instanceof HTMLElement && target.closest('[role="dialog"]') !== event.currentTarget) return;
        if (event.key === "Escape") { setOpen(false); triggerRef.current?.focus(); return; }
        if (event.key !== "Tab") return;
        const focusable = Array.from(event.currentTarget.querySelectorAll<HTMLElement>("button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex='0']"));
        const first = focusable[0]; const last = focusable.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }}>
        <div className="dialog-heading"><h2 id="add-item-title">{t("addItem")}</h2><button type="button" className="icon-button" aria-label={t("close")} onClick={() => { setOpen(false); triggerRef.current?.focus(); }}>×</button></div>
        <form action={action} className="photo-add-form">
          <PhotoAcquisition name="photo"/>
          <div className="photo-add-fields">
            <label className="field"><span>{t("itemName")}</span><input name="name" value={draft.name} placeholder={t("itemNamePlaceholder")} maxLength={160} onChange={update("name")}/></label>
            <label className="field"><span>{t("itemModel")}</span><input name="model" value={draft.model} placeholder={t("itemModelPlaceholder")} maxLength={160} onChange={update("model")}/></label>
            <label className="field"><span>{t("itemBrand")}</span><input name="brand" value={draft.brand} placeholder={t("brandPlaceholder")} maxLength={120} onChange={update("brand")}/></label>
            <CategoryField value={draft.category}/>
            <label className="field"><span>{t("itemOriginalMarking")}</span><input name="originalMarking" value={draft.originalMarking} placeholder={t("markingPlaceholder")} maxLength={160} onChange={update("originalMarking")}/></label>
          </div>
          <details className="advanced-fields"><summary>{t("additionalDetails")}</summary><div className="detail-grid advanced-item-fields">
            <label className="field full-field"><span>{t("itemDescription")}</span><textarea name="description" maxLength={4000} value={draft.description} onChange={update("description")}/></label>
            <label className="field full-field"><span>{t("itemNotes")}</span><textarea name="notes" maxLength={2000} value={draft.notes} onChange={update("notes")}/></label>
          </div></details>
          <input type="hidden" name="trackingMode" value="unique"/>
          {feedback.message ? <p className="form-error" role="alert">{feedback.message}</p> : null}
          <FormSubmitButton className="add-button" pendingLabel={t("addingItem")}><Plus size={16} aria-hidden="true"/><span>{t("addItem")}</span></FormSubmitButton>
        </form>
      </section>
    </div> : null}
  </>;
}
