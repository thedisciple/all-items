"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { updateStockAction, type ActionFeedback } from "@/app/actions";
import { FormSubmitButton } from "./form-submit-button";
import { useI18n } from "@/i18n/provider";
import { Plus, Save, Trash2 } from "lucide-react";

type StockRow = { location: string | null; quantity: number };
const initialFeedback: ActionFeedback = { status: "idle", message: "" };

export function StockEditor({ itemId, initialRows, trackingMode }: { itemId: string; initialRows: StockRow[]; trackingMode: string }) {
  const { t } = useI18n();
  const [rows, setRows] = useState(() => initialRows.length ? initialRows.map((row) => ({ location: row.location ?? "", quantity: row.quantity })) : [{ location: "", quantity: 0 }]);
  const [feedback, action] = useActionState(updateStockAction, initialFeedback);
  const router = useRouter();
  const initial = JSON.stringify(initialRows.length ? initialRows.map((row) => ({ location: row.location ?? "", quantity: row.quantity })) : [{ location: "", quantity: 0 }]);
  const dirty = JSON.stringify(rows) !== initial;

  useEffect(() => { if (feedback.status === "success") router.refresh(); }, [feedback, router]);

  return <form action={action} className="detail-panel stock-editor">
    <input type="hidden" name="id" value={itemId}/>
    <div className="section-heading"><h2>{t("stock")}</h2></div>
    <div className="stock-rows">{rows.map((row, index) => <div className="stock-row" key={index}>
      <label className="field stock-location-field"><span>{t("locationName")} {index === 0 ? "" : index + 1}</span><input name="location" maxLength={120} value={row.location} placeholder={t("locationPlaceholder")} onChange={(event) => setRows((current) => current.map((entry, entryIndex) => entryIndex === index ? { ...entry, location: event.target.value } : entry))}/></label>
      <label className="field stock-quantity-field"><span>{t("quantity")}</span><input type="number" name="quantity" min={0} max={trackingMode === "unique" ? 1 : 1000000} step={1} required value={row.quantity} onChange={(event) => setRows((current) => current.map((entry, entryIndex) => entryIndex === index ? { ...entry, quantity: event.target.value === "" ? 0 : Number(event.target.value) } : entry))}/></label>
      <button type="button" className="icon-button stock-remove-button" aria-label={t("removeRow", { number: index + 1 })} title={t("removeRow", { number: index + 1 })} disabled={rows.length === 1} onClick={() => setRows((current) => current.filter((_, entryIndex) => entryIndex !== index))}><Trash2 size={16} aria-hidden="true"/></button>
    </div>)}</div>
    <div className="stock-actions"><button type="button" className="quiet-button" disabled={rows.length >= 50 || trackingMode === "unique"} onClick={() => setRows((current) => [...current, { location: "", quantity: 0 }])}><Plus size={15} aria-hidden="true"/>{t("addLocation")}</button><FormSubmitButton disabled={!dirty} pendingLabel={t("savingStock")}><Save size={15} aria-hidden="true"/>{t("saveStock")}</FormSubmitButton></div>
    {feedback.status === "error" && feedback.message ? <p className="inline-status error-status" role="alert">{feedback.message}</p> : feedback.status === "success" && feedback.message ? <p className="visually-hidden" role="status">{feedback.message}</p> : null}
  </form>;
}
