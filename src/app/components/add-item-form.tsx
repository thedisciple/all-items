"use client";

import { useActionState, useState } from "react";
import { Plus } from "lucide-react";
import { addItemAction, type ActionFeedback } from "@/app/actions";
import { PhotoAcquisition } from "./photo-acquisition";
import { FormSubmitButton } from "./form-submit-button";

const idle: ActionFeedback = { status: "idle", message: "" };
type Draft = { name: string; model: string; brand: string; category: string; originalMarking: string };

export function AddItemForm() {
  const [feedback, action] = useActionState(addItemAction, idle);
  const [draft, setDraft] = useState<Draft>({ name: "", model: "", brand: "", category: "", originalMarking: "" });
  const update = (key: keyof Draft) => (event: React.ChangeEvent<HTMLInputElement>) => setDraft((current) => ({ ...current, [key]: event.target.value }));
  return <form action={action} className="photo-add-form">
    <PhotoAcquisition name="photo"/>
    <div className="photo-add-fields">
      <label className="field"><span>Название <em>можно оставить пустым при добавлении фото</em></span><input name="name" value={draft.name} placeholder="Например, плата Arduino Uno" maxLength={160} onChange={update("name")}/></label>
      <label className="field"><span>Модель или маркировка</span><input name="model" value={draft.model} placeholder="Например, R3" maxLength={160} onChange={update("model")}/></label>
      <label className="field"><span>Бренд</span><input name="brand" value={draft.brand} placeholder="Производитель" maxLength={120} onChange={update("brand")}/></label>
      <label className="field"><span>Категория</span><input name="category" value={draft.category} placeholder="Например, электроника" maxLength={80} onChange={update("category")}/></label>
      <label className="field"><span>Оригинальная маркировка</span><input name="originalMarking" value={draft.originalMarking} placeholder="Маркировка на корпусе" maxLength={160} onChange={update("originalMarking")}/></label>
    </div>
    <input type="hidden" name="trackingMode" value="unique"/>
    {feedback.message ? <p className="form-error" role="alert">{feedback.message}</p> : null}
    <FormSubmitButton className="add-button" pendingLabel="Добавляем…"><Plus size={14} aria-hidden="true"/> Добавить вещь</FormSubmitButton>
  </form>;
}
