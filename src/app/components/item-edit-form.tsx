"use client";

import { startTransition, useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { updateItemAction, type ActionFeedback } from "@/app/actions";
import { FormSubmitButton } from "./form-submit-button";
import { InventoryStockFields, validStockDraft, stockDraftSignature, type StockDraft } from "./inventory-stock-fields";
import { CategoryField } from "./category-field";
import { useI18n } from "@/i18n/provider";

const idle: ActionFeedback = { status: "idle", message: "" };
type Draft = {
  name: string; model: string; brand: string; categories: string[]; originalMarking: string;
  identificationStatus: string; trackingMode: string; saleIntent: string; askingPrice: string;
  askingCurrency: string; description: string; notes: string;
};

export function ItemEditForm({ itemId, initial, initialRows, returnTo = "/" }: { itemId: string; initial: Draft; initialRows: { location: string | null; quantity: number }[]; returnTo?: string }) {
  const { t } = useI18n();
  const [draft, setDraft] = useState(initial);
  const initialStock = initialRows.length ? initialRows.map(row => ({ location: row.location ?? "", quantity: String(row.quantity) })) : [{ location: "", quantity: initial.trackingMode === "unique" ? "1" : "0" }];
  const [rows, setRows] = useState<StockDraft[]>(initialStock);
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial) || stockDraftSignature(rows) !== stockDraftSignature(initialStock);
  const [feedback, action, pending] = useActionState(updateItemAction, idle);
  const router = useRouter();
  useEffect(() => { if (feedback.status === "success") router.push(returnTo); }, [feedback, returnTo, router]);
  const field = (key: keyof Draft) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setDraft((value) => ({ ...value, [key]: event.target.value }));

  return <form aria-busy={pending} onSubmit={event => { event.preventDefault(); if (!pending) { const data = new FormData(event.currentTarget); startTransition(() => action(data)); } }} className="detail-panel item-edit-form">
    <input type="hidden" name="id" value={itemId}/><input type="hidden" name="returnTo" value={returnTo}/>
    <div className="section-heading"><div><h2>{t("details")}</h2></div></div>
    <div className="detail-grid basic-item-fields">
      <label className="field"><span>{t("itemName")} *</span><input required maxLength={160} name="name" value={draft.name} onChange={field("name")}/></label>
      <label className="field"><span>{t("itemModel")}</span><input maxLength={160} name="model" value={draft.model} onChange={field("model")}/></label>
      <label className="field"><span>{t("itemBrand")}</span><input maxLength={120} name="brand" value={draft.brand} onChange={field("brand")}/></label>
      <CategoryField values={draft.categories} onValueChange={(categories) => setDraft((value) => ({ ...value, categories }))}/>
    </div>
    <InventoryStockFields mode={draft.trackingMode} rows={rows} onModeChange={trackingMode => setDraft(value => ({ ...value, trackingMode }))} onRowsChange={setRows}/>
    <details id="item-details" className="advanced-fields"><summary>{t("additionalDetails")}</summary><div className="detail-grid advanced-item-fields">
      <label className="field"><span>{t("itemOriginalMarking")}</span><input maxLength={160} name="originalMarking" value={draft.originalMarking} onChange={field("originalMarking")}/></label>
      <label className="field"><span>{t("identificationStatus")}</span><select name="identificationStatus" value={draft.identificationStatus} onChange={field("identificationStatus")}><option value="unknown">{t("itemStatusUnknown")}</option><option value="user_confirmed">{t("itemStatusConfirmed")}</option><option value="source_verified">{t("itemStatusVerified")}</option></select></label>

      <label className="field"><span>{t("saleIntent")}</span><select name="saleIntent" value={draft.saleIntent} onChange={field("saleIntent")}><option value="not_for_sale">{t("saleNo")}</option><option value="considering">{t("saleConsidering")}</option><option value="willing_to_sell">{t("saleYes")}</option></select></label>
      <label className="field"><span>{t("askingPrice")}</span><input type="number" min="0" step="0.01" name="askingPrice" value={draft.askingPrice} onChange={field("askingPrice")}/></label>
      <label className="field"><span>{t("currency")}</span><select name="askingCurrency" value={draft.askingCurrency} onChange={field("askingCurrency")}><option value="RUB">RUB</option><option value="EUR">EUR</option><option value="USD">USD</option><option value="HUF">HUF</option></select></label>
      <label className="field full-field"><span>{t("itemDescription")}</span><textarea name="description" maxLength={4000} value={draft.description} onChange={field("description")}/></label>
      <label className="field full-field"><span>{t("itemNotes")}</span><textarea name="notes" maxLength={2000} value={draft.notes} onChange={field("notes")}/></label>
    </div></details>
    <div className="form-action-row"><FormSubmitButton className="add-button" disabled={pending || !dirty || !draft.name.trim() || !validStockDraft(rows, draft.trackingMode)} pendingLabel={t("savingChanges")}>{pending ? t("savingChanges") : t("saveChanges")}</FormSubmitButton>
      <a className="quiet-button" href={returnTo}>{t("cancel")}</a>
      {feedback.status === "error" && feedback.message ? <p className="inline-status error-status" role="alert">{feedback.message}</p> : null}
    </div>
  </form>;
}
