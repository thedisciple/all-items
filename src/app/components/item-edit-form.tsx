"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { updateItemAction, type ActionFeedback } from "@/app/actions";
import { FormSubmitButton } from "./form-submit-button";

const idle: ActionFeedback = { status: "idle", message: "" };
type Draft = {
  name: string; model: string; brand: string; category: string; originalMarking: string;
  identificationStatus: string; trackingMode: string; saleIntent: string; askingPrice: string;
  askingCurrency: string; description: string; notes: string;
};

export function ItemEditForm({ itemId, initial }: { itemId: string; initial: Draft }) {
  const [draft, setDraft] = useState(initial);
  const [feedback, action] = useActionState(updateItemAction, idle);
  const router = useRouter();
  useEffect(() => { if (feedback.status === "success") router.refresh(); }, [feedback, router]);
  const field = (key: keyof Draft) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setDraft((value) => ({ ...value, [key]: event.target.value }));

  return <form action={action} className="detail-panel item-edit-form">
    <input type="hidden" name="id" value={itemId}/>
    <div className="section-heading"><div><h2>Сведения</h2><p className="field-help">Название и основные данные. Редкие и личные сведения — ниже.</p></div></div>
    <div className="detail-grid basic-item-fields">
      <label className="field"><span>Название *</span><input required maxLength={160} name="name" value={draft.name} onChange={field("name")}/></label>
      <label className="field"><span>Модель</span><input maxLength={160} name="model" value={draft.model} onChange={field("model")}/></label>
      <label className="field"><span>Бренд</span><input maxLength={120} name="brand" value={draft.brand} onChange={field("brand")}/></label>
      <label className="field"><span>Категория</span><input maxLength={80} name="category" value={draft.category} onChange={field("category")}/></label>
    </div>
    <details className="advanced-fields"><summary>Дополнительные сведения</summary><div className="detail-grid advanced-item-fields">
      <label className="field"><span>Оригинальная маркировка</span><input maxLength={160} name="originalMarking" value={draft.originalMarking} onChange={field("originalMarking")}/></label>
      <label className="field"><span>Статус определения</span><select name="identificationStatus" value={draft.identificationStatus} onChange={field("identificationStatus")}><option value="unknown">Не определён</option><option value="user_confirmed">Подтверждён мной</option><option value="source_verified">Проверен по источнику</option></select></label>
      <label className="field"><span>Режим учёта</span><select name="trackingMode" value={draft.trackingMode} onChange={field("trackingMode")}><option value="unique">Уникальная вещь</option><option value="bulk">Штучный запас</option><option value="consumable">Расходный материал</option></select></label>
      <label className="field"><span>План продажи · только для вас</span><select name="saleIntent" value={draft.saleIntent} onChange={field("saleIntent")}><option value="not_for_sale">Не планирую продавать</option><option value="considering">Рассматриваю продажу</option><option value="willing_to_sell">Готов продать лично</option></select></label>
      <label className="field"><span>Цена · только для вас</span><input type="number" min="0" step="0.01" name="askingPrice" value={draft.askingPrice} onChange={field("askingPrice")}/></label>
      <label className="field"><span>Валюта</span><select name="askingCurrency" value={draft.askingCurrency} onChange={field("askingCurrency")}><option value="RUB">RUB</option><option value="EUR">EUR</option><option value="USD">USD</option><option value="HUF">HUF</option></select></label>
      <label className="field full-field"><span>Описание</span><textarea name="description" maxLength={4000} value={draft.description} onChange={field("description")}/></label>
      <label className="field full-field"><span>Заметки · только для вас</span><textarea name="notes" maxLength={2000} value={draft.notes} onChange={field("notes")}/></label>
    </div></details>
    <div className="form-action-row"><FormSubmitButton className="add-button" pendingLabel="Сохраняем…">Сохранить изменения</FormSubmitButton>
      {feedback.message ? <p className={`inline-status ${feedback.status === "error" ? "error-status" : "success-status"}`} role={feedback.status === "error" ? "alert" : "status"}>{feedback.message}</p> : null}
    </div>
  </form>;
}
