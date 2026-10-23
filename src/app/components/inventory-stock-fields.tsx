"use client";

import { useEffect, useRef } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useI18n } from "@/i18n/provider";

export type StockDraft = { location: string; quantity: string };
export const stockDraftSignature = (rows: StockDraft[]) => JSON.stringify(rows.filter(row => row.location.trim() || Number(row.quantity) > 0).map(row => ({ location: row.location.trim(), quantity: Number(row.quantity) })));
export function validStockDraft(rows: StockDraft[], mode: string) {
  if (rows.some(row => !/^\d{1,7}$/.test(row.quantity) || Number(row.quantity) > 1_000_000 || row.location.length > 120)) return false;
  const meaningful = rows.filter(row => row.location.trim() || Number(row.quantity) > 0);
  if (new Set(meaningful.map(row => row.location.trim().toLocaleLowerCase("ru-RU"))).size !== meaningful.length) return false;
  return mode !== "unique" || meaningful.length === 1 && Number(meaningful[0]!.quantity) === 1;
}

export function InventoryStockFields({ mode, rows, onModeChange, onRowsChange }: { mode: string; rows: StockDraft[]; onModeChange: (mode: string) => void; onRowsChange: (rows: StockDraft[]) => void }) {
  const { t } = useI18n();
  const lastLocation = useRef<HTMLInputElement>(null);
  const focusNew = useRef(false);
  useEffect(() => { if (focusNew.current) { lastLocation.current?.focus(); focusNew.current = false; } }, [rows.length]);
  const incompatible = mode === "unique" && !validStockDraft(rows, mode);
  const change = (index: number, field: keyof StockDraft, value: string) => onRowsChange(rows.map((row, i) => i === index ? { ...row, [field]: value } : row));
  return <section className="inventory-stock-fields">
    <label className="field"><span>{t("trackingMode")}</span><select name="trackingMode" value={mode} onChange={event => {
      const next = event.target.value;
      onModeChange(next);
    }}><option value="unique">{t("trackingUnique")}</option><option value="bulk">{t("trackingBulk")}</option><option value="consumable">{t("trackingConsumable")}</option></select></label>
    <input type="hidden" name="stock" value={JSON.stringify(rows)}/>
    {incompatible ? <p className="form-error" role="alert">{t("stockModeConflict")}</p> : <div className="stock-rows">{rows.map((row, index) => <div className={`stock-row${mode === "unique" ? " stock-row-unique" : ""}`} key={index}>
      <label className="field"><span>{t("locationName")} {rows.length > 1 ? index + 1 : ""}</span><input ref={index === rows.length-1 ? lastLocation : undefined} value={row.location} maxLength={120} placeholder={t("locationPlaceholder")} onChange={event => change(index,"location",event.target.value)}/></label>
      {mode !== "unique" ? <><label className="field"><span>{t("quantity")}</span><input type="text" inputMode="numeric" value={row.quantity} required pattern="[0-9]{1,7}" onChange={event => change(index,"quantity",event.target.value)}/></label><button className="icon-button" type="button" aria-label={t("removeRow", { number: index+1 })} disabled={rows.length === 1} onClick={() => onRowsChange(rows.filter((_, i) => i !== index))}><Trash2 size={16} aria-hidden="true"/></button></> : null}
    </div>)}</div>}
    {mode !== "unique" ? <button className="quiet-button" type="button" disabled={rows.length >= 50} onClick={() => { focusNew.current = true; onRowsChange([...rows, { location: "", quantity: "0" }]); }}><Plus size={15} aria-hidden="true"/>{t("addLocation")}</button> : null}
    {!incompatible && !validStockDraft(rows, mode) ? <p className="form-error" role="alert">{t("stockQuantityInvalid")}</p> : null}
  </section>;
}
