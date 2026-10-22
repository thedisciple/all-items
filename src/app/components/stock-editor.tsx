"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { updateStockAction, type ActionFeedback } from "@/app/actions";
import { FormSubmitButton } from "./form-submit-button";

type StockRow = { location: string | null; quantity: number };
const initialFeedback: ActionFeedback = { status: "idle", message: "" };

export function StockEditor({ itemId, initialRows, trackingMode }: { itemId: string; initialRows: StockRow[]; trackingMode: string }) {
  const [rows, setRows] = useState(() => initialRows.length ? initialRows.map((row) => ({ location: row.location ?? "", quantity: row.quantity })) : [{ location: "", quantity: 0 }]);
  const [feedback, action] = useActionState(updateStockAction, initialFeedback);
  const router = useRouter();
  const total = rows.reduce((sum, row) => sum + (Number.isFinite(row.quantity) ? row.quantity : 0), 0);

  useEffect(() => { if (feedback.status === "success") router.refresh(); }, [feedback, router]);

  return <form action={action} className="detail-panel stock-editor">
    <input type="hidden" name="id" value={itemId}/>
    <div className="section-heading"><div><h2>Количество и места хранения</h2><p className="field-help">{trackingMode === "unique" ? "Для уникальной вещи общее количество должно быть равно 1." : trackingMode === "consumable" ? "Укажите, сколько материала осталось в каждом месте." : "Разделите запас между местами хранения."}</p></div><output className="stock-total" aria-live="polite"><span>Всего</span><strong>{total}</strong></output></div>
    <div className="stock-rows">{rows.map((row, index) => <div className="stock-row" key={index}>
      <label className="field stock-location-field"><span>Место хранения {index === 0 ? "" : index + 1}</span><input name="location" maxLength={120} value={row.location} placeholder="Например, шкаф A" onChange={(event) => setRows((current) => current.map((entry, entryIndex) => entryIndex === index ? { ...entry, location: event.target.value } : entry))}/></label>
      <label className="field stock-quantity-field"><span>Количество</span><input type="number" name="quantity" min={0} max={1000000} step={1} required value={row.quantity} onChange={(event) => setRows((current) => current.map((entry, entryIndex) => entryIndex === index ? { ...entry, quantity: event.target.value === "" ? 0 : Number(event.target.value) } : entry))}/></label>
      <button type="button" className="icon-button stock-remove-button" aria-label={`Убрать строку ${index + 1}`} title="Убрать строку" disabled={rows.length === 1} onClick={() => setRows((current) => current.filter((_, entryIndex) => entryIndex !== index))}>×</button>
    </div>)}</div>
    <div className="stock-actions"><button type="button" className="text-button" disabled={rows.length >= 50} onClick={() => setRows((current) => [...current, { location: "", quantity: 0 }])}>+ Добавить место хранения</button><FormSubmitButton pendingLabel="Сохраняем запас…">Сохранить запас</FormSubmitButton></div>
    {feedback.message ? <p className={`inline-status ${feedback.status === "error" ? "error-status" : "success-status"}`} role={feedback.status === "error" ? "alert" : "status"}>{feedback.message}</p> : null}
  </form>;
}
