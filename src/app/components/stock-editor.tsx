"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { updateStockAction, type ActionFeedback } from "@/app/actions";
import { FormSubmitButton } from "./form-submit-button";
import { useI18n } from "@/i18n/provider";
import { Plus, Save, Trash2 } from "lucide-react";

type StockRow = { location: string | null; quantity: number };
type DraftRow = { key: number; location: string; quantity: string };
const initialFeedback: ActionFeedback = { status: "idle", message: "" };

export function StockEditor({ itemId, initialRows, trackingMode }: { itemId: string; initialRows: StockRow[]; trackingMode: string }) {
  const { t } = useI18n();
  const initial = initialRows.length ? initialRows : [{ location: null, quantity: trackingMode === "unique" ? 1 : 0 }];
  const [rows, setRows] = useState<DraftRow[]>(() => initial.map((row, key) => ({ key, location: row.location ?? "", quantity: String(row.quantity) })));
  const nextKey = useRef(rows.length);
  const newLocation = useRef<HTMLInputElement>(null);
  const focusNew = useRef(false);
  const [feedback, action] = useActionState(updateStockAction, initialFeedback);
  const router = useRouter();
  const normalized = rows.map(({ location, quantity }) => ({ location, quantity: Number(quantity) }));
  const dirty = JSON.stringify(normalized) !== JSON.stringify(initial.map((row) => ({ location: row.location ?? "", quantity: row.quantity })));
  const invalid = trackingMode !== "unique" && rows.some((row) => !/^\d{1,7}$/.test(row.quantity) || Number(row.quantity) > 1_000_000);

  useEffect(() => { if (feedback.status === "success") router.refresh(); }, [feedback, router]);
  useEffect(() => { if (focusNew.current) { newLocation.current?.focus(); focusNew.current = false; } }, [rows.length]);

  function changeRow(key: number, patch: Partial<DraftRow>) {
    setRows((current) => current.map((row) => row.key === key ? { ...row, ...patch } : row));
  }

  return <form action={action} className="detail-panel stock-editor">
    <input type="hidden" name="id" value={itemId}/>
    <div className="section-heading"><h2>{t("stock")}</h2></div>
    <div className="stock-rows">{rows.map((row, index) => <div className={`stock-row${trackingMode === "unique" ? " stock-row-unique" : ""}`} key={row.key}>
      <label className="field stock-location-field"><span>{t("locationName")} {index === 0 ? "" : index + 1}</span><input ref={index === rows.length - 1 ? newLocation : undefined} name="location" maxLength={120} value={row.location} placeholder={t("locationPlaceholder")} onChange={(event) => changeRow(row.key, { location: event.target.value })}/></label>
      {trackingMode === "unique" ? <input type="hidden" name="quantity" value="1"/> : <label className="field stock-quantity-field"><span>{t("quantity")}</span><input type="text" inputMode="numeric" pattern="[0-9]*" name="quantity" required value={row.quantity} onChange={(event) => { if (/^\d{0,7}$/.test(event.target.value)) changeRow(row.key, { quantity: event.target.value }); }} onBlur={() => { if (/^\d+$/.test(row.quantity)) changeRow(row.key, { quantity: String(Number(row.quantity)) }); }}/></label>}
      {trackingMode !== "unique" && rows.length > 1 ? <button type="button" className="icon-button stock-remove-button" aria-label={t("removeRow", { number: index + 1 })} title={t("removeRow", { number: index + 1 })} onClick={() => setRows((current) => current.filter((entry) => entry.key !== row.key))}><Trash2 size={16} aria-hidden="true"/></button> : null}
    </div>)}</div>
    <div className="stock-actions">{trackingMode === "unique" ? <button type="button" className="quiet-button" onClick={() => { const details = document.getElementById("item-details") as HTMLDetailsElement | null; if (details) { details.open = true; details.querySelector<HTMLSelectElement>('select[name="trackingMode"]')?.focus(); details.scrollIntoView({ block: "nearest" }); } }}>{t("trackingMode")}</button> : <button type="button" className="quiet-button" disabled={rows.length >= 50} onClick={() => { focusNew.current = true; setRows((current) => [...current, { key: nextKey.current++, location: "", quantity: "0" }]); }}><Plus size={15} aria-hidden="true"/>{t("addLocation")}</button>}<FormSubmitButton disabled={!dirty || invalid} pendingLabel={t("savingStock")}><Save size={15} aria-hidden="true"/>{t("saveStock")}</FormSubmitButton></div>
    {feedback.status === "error" && feedback.message ? <p className="inline-status error-status" role="alert">{feedback.message}</p> : feedback.status === "success" && feedback.message ? <p className="visually-hidden" role="status">{feedback.message}</p> : null}
  </form>;
}
