"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { updateItemAction, type ActionFeedback } from "@/app/actions";
import { FormSubmitButton } from "./form-submit-button";
import { CategoryField } from "./category-field";
import { useI18n } from "@/i18n/provider";

const idle: ActionFeedback = { status: "idle", message: "" };
type Draft = {
  name: string; model: string; brand: string; category: string; originalMarking: string;
  identificationStatus: string; trackingMode: string; saleIntent: string; askingPrice: string;
  askingCurrency: string; description: string; notes: string;
};

export function ItemEditForm({ itemId, initial, returnTo = "/" }: { itemId: string; initial: Draft; returnTo?: string }) {
  const { t } = useI18n();
  const [draft, setDraft] = useState(initial);
  const [feedback, action] = useActionState(updateItemAction, idle);
  const router = useRouter();
  useEffect(() => { if (feedback.status === "success") router.push(`${returnTo}${returnTo.includes("?") ? "&" : "?"}updated=1`); }, [feedback, returnTo, router]);
  const field = (key: keyof Draft) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setDraft((value) => ({ ...value, [key]: event.target.value }));

  return <form action={action} className="detail-panel item-edit-form">
    <input type="hidden" name="id" value={itemId}/><input type="hidden" name="returnTo" value={returnTo}/>
    <div className="section-heading"><div><h2>{t("details")}</h2></div></div>
    <div className="detail-grid basic-item-fields">
      <label className="field"><span>{t("itemName")} *</span><input required maxLength={160} name="name" value={draft.name} onChange={field("name")}/></label>
      <label className="field"><span>{t("itemModel")}</span><input maxLength={160} name="model" value={draft.model} onChange={field("model")}/></label>
      <label className="field"><span>{t("itemBrand")}</span><input maxLength={120} name="brand" value={draft.brand} onChange={field("brand")}/></label>
      <CategoryField value={draft.category} onValueChange={(category) => setDraft((value) => ({ ...value, category }))}/>
    </div>
    <details className="advanced-fields"><summary>{t("additionalDetails")}</summary><div className="detail-grid advanced-item-fields">
      <label className="field"><span>{t("itemOriginalMarking")}</span><input maxLength={160} name="originalMarking" value={draft.originalMarking} onChange={field("originalMarking")}/></label>
      <label className="field"><span>{t("identificationStatus")}</span><select name="identificationStatus" value={draft.identificationStatus} onChange={field("identificationStatus")}><option value="unknown">{t("itemStatusUnknown")}</option><option value="user_confirmed">{t("itemStatusConfirmed")}</option><option value="source_verified">{t("itemStatusVerified")}</option></select></label>
      <label className="field"><span>{t("trackingMode")}</span><select name="trackingMode" value={draft.trackingMode} onChange={field("trackingMode")}><option value="unique">{t("trackingUnique")}</option><option value="bulk">{t("trackingBulk")}</option><option value="consumable">{t("trackingConsumable")}</option></select></label>
      <label className="field"><span>{t("saleIntent")}</span><select name="saleIntent" value={draft.saleIntent} onChange={field("saleIntent")}><option value="not_for_sale">{t("saleNo")}</option><option value="considering">{t("saleConsidering")}</option><option value="willing_to_sell">{t("saleYes")}</option></select></label>
      <label className="field"><span>{t("askingPrice")}</span><input type="number" min="0" step="0.01" name="askingPrice" value={draft.askingPrice} onChange={field("askingPrice")}/></label>
      <label className="field"><span>{t("currency")}</span><select name="askingCurrency" value={draft.askingCurrency} onChange={field("askingCurrency")}><option value="RUB">RUB</option><option value="EUR">EUR</option><option value="USD">USD</option><option value="HUF">HUF</option></select></label>
      <label className="field full-field"><span>{t("itemDescription")}</span><textarea name="description" maxLength={4000} value={draft.description} onChange={field("description")}/></label>
      <label className="field full-field"><span>{t("itemNotes")}</span><textarea name="notes" maxLength={2000} value={draft.notes} onChange={field("notes")}/></label>
    </div></details>
    <div className="form-action-row"><FormSubmitButton className="add-button" pendingLabel={t("savingChanges")}>{t("saveChanges")}</FormSubmitButton>
      <a className="text-button" href={returnTo}>{t("cancel")}</a>
      {feedback.status === "error" && feedback.message ? <p className="inline-status error-status" role="alert">{feedback.message}</p> : null}
    </div>
  </form>;
}
