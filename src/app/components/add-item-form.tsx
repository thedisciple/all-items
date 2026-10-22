"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { addItemAction, type ActionFeedback } from "@/app/actions";
import { PhotoAcquisition } from "./photo-acquisition";
import { FormSubmitButton } from "./form-submit-button";
import { CategoryField } from "./category-field";
import { useI18n } from "@/i18n/provider";

const idle: ActionFeedback = { status: "idle", message: "" };
type Draft = { name: string; model: string; brand: string; category: string; originalMarking: string; description: string; notes: string; identificationStatus: string; saleIntent: string; askingPrice: string; askingCurrency: string };

export function AddItemForm() {
  const { t } = useI18n();
  const [feedback, action] = useActionState(addItemAction, idle);
  const [draft, setDraft] = useState<Draft>({ name: "", model: "", brand: "", category: "", originalMarking: "", description: "", notes: "", identificationStatus: "unknown", saleIntent: "not_for_sale", askingPrice: "", askingCurrency: "RUB" });
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const router = useRouter();
  const photoDirty = useRef(false);
  const submitLocked = useRef(false);
  const [resetToken, setResetToken] = useState(0);
  const dirty = Object.values(draft).some(Boolean) || photoDirty.current;
  const update = (key: keyof Draft) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setDraft((current) => ({ ...current, [key]: event.target.value }));

  useEffect(() => {
    if (feedback.status === "success" && feedback.itemId) {
      setDraft({ name: "", model: "", brand: "", category: "", originalMarking: "", description: "", notes: "", identificationStatus: "unknown", saleIntent: "not_for_sale", askingPrice: "", askingCurrency: "RUB" });
      setResetToken((value) => value + 1);
      photoDirty.current = false;
      setOpen(false);
      router.push(`/?added=${feedback.itemId}`);
    }
    if (feedback.status === "error") submitLocked.current = false;
  }, [feedback, router]);

  useEffect(() => {
    if (!open) return;
    dialogRef.current?.querySelector<HTMLElement>("button:not([disabled]),input:not([disabled]):not([type='hidden']):not(.visually-hidden),select:not([disabled]),textarea:not([disabled])")?.focus();
  }, [open]);

  return <>
    <button ref={triggerRef} type="button" className="add-button add-dialog-trigger" onClick={() => setOpen(true)}><Plus size={17} aria-hidden="true"/><span>{t("addItem")}</span></button>
    <div className="photo-source-overlay add-dialog-overlay" role="presentation" hidden={!open}>
      <section ref={dialogRef} className="photo-source-dialog add-item-dialog" role="dialog" aria-modal="true" aria-labelledby="add-item-title" onKeyDown={(event) => {
        const target = event.target;
        if (target instanceof HTMLElement && target.closest('[role="dialog"]') !== event.currentTarget) return;
        if (event.key === "Escape") { if (!dirty) { setOpen(false); triggerRef.current?.focus(); } return; }
        if (event.key !== "Tab") return;
        const focusable = Array.from(event.currentTarget.querySelectorAll<HTMLElement>("button:not([disabled]),input:not([disabled]):not([type='hidden']):not(.visually-hidden),select:not([disabled]),textarea:not([disabled]),[tabindex='0']"));
        const first = focusable[0]; const last = focusable.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }}>
        <div className="dialog-heading"><h2 id="add-item-title">{t("addItem")}</h2><button type="button" className="icon-button" aria-label={t("close")} onClick={() => { setOpen(false); triggerRef.current?.focus(); }}>×</button></div>
        <form action={action} className="photo-add-form" onSubmit={(event) => { if (submitLocked.current) event.preventDefault(); else submitLocked.current = true; }}>
          <PhotoAcquisition name="photo" resetToken={resetToken} onDraftChange={(value) => { photoDirty.current = value; }}/>
          <div className="photo-add-fields">
            <label className="field"><span>{t("itemName")}</span><input name="name" value={draft.name} placeholder={t("itemNamePlaceholder")} maxLength={160} onChange={update("name")}/></label>
            <label className="field"><span>{t("itemModel")}</span><input name="model" value={draft.model} placeholder={t("itemModelPlaceholder")} maxLength={160} onChange={update("model")}/></label>
            <label className="field"><span>{t("itemBrand")}</span><input name="brand" value={draft.brand} placeholder={t("brandPlaceholder")} maxLength={120} onChange={update("brand")}/></label>
            <CategoryField key={resetToken} value={draft.category} onValueChange={(category) => setDraft((current) => ({ ...current, category }))}/>
          </div>
          <details className="advanced-fields"><summary>{t("additionalDetails")}</summary><div className="detail-grid advanced-item-fields">
            <label className="field"><span>{t("itemOriginalMarking")}</span><input name="originalMarking" value={draft.originalMarking} placeholder={t("markingPlaceholder")} maxLength={160} onChange={update("originalMarking")}/></label>
            <label className="field"><span>{t("identificationStatus")}</span><select name="identificationStatus" value={draft.identificationStatus} onChange={(event) => setDraft((current) => ({ ...current, identificationStatus: event.target.value }))}><option value="unknown">{t("itemStatusUnknown")}</option><option value="user_confirmed">{t("itemStatusConfirmed")}</option><option value="source_verified">{t("itemStatusVerified")}</option></select></label>
            <label className="field"><span>{t("saleIntent")}</span><select name="saleIntent" value={draft.saleIntent} onChange={(event) => setDraft((current) => ({ ...current, saleIntent: event.target.value }))}><option value="not_for_sale">{t("saleNo")}</option><option value="considering">{t("saleConsidering")}</option><option value="willing_to_sell">{t("saleYes")}</option></select></label>
            <label className="field"><span>{t("askingPrice")}</span><input type="number" min="0" step="0.01" name="askingPrice" value={draft.askingPrice} onChange={(event) => setDraft((current) => ({ ...current, askingPrice: event.target.value }))}/></label>
            <label className="field"><span>{t("currency")}</span><select name="askingCurrency" value={draft.askingCurrency} onChange={(event) => setDraft((current) => ({ ...current, askingCurrency: event.target.value }))}><option>RUB</option><option>EUR</option><option>USD</option><option>HUF</option></select></label>
            <label className="field full-field"><span>{t("itemDescription")}</span><textarea name="description" maxLength={4000} value={draft.description} onChange={update("description")}/></label>
            <label className="field full-field"><span>{t("itemNotes")}</span><textarea name="notes" maxLength={2000} value={draft.notes} onChange={update("notes")}/></label>
          </div></details>
          <input type="hidden" name="trackingMode" value="unique"/>
          {feedback.status === "error" && feedback.message ? <p className="form-error" role="alert">{feedback.message}</p> : null}
          <div className="dialog-actions"><FormSubmitButton className="add-button" pendingLabel={t("addingItem")}><Plus size={16} aria-hidden="true"/><span>{t("addItem")}</span></FormSubmitButton><button type="button" className="text-button" onClick={() => { setOpen(false); triggerRef.current?.focus(); }}>{t("close")}</button>{dirty ? <button type="button" className="text-button" onClick={() => { if (window.confirm(t("discardDraftConfirm"))) { setDraft({ name: "", model: "", brand: "", category: "", originalMarking: "", description: "", notes: "", identificationStatus: "unknown", saleIntent: "not_for_sale", askingPrice: "", askingCurrency: "RUB" }); setResetToken((value) => value + 1); photoDirty.current = false; } }}>{t("discardDraft")}</button> : null}</div>
        </form>
      </section>
    </div>
  </>;
}
