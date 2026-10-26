"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, X } from "lucide-react";
import { canonicalCategories, categories, categoryEmoji, categoryMessageKey } from "@/items/categories";
import { useI18n } from "@/i18n/provider";

export function CategoryField({ values, onValueChange }: { values: string[]; onValueChange: (values: string[]) => void }) {
  const { t } = useI18n();
  const [custom, setCustom] = useState("");
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const dismiss = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, [open]);
  const label = (value: string) => { const key = categoryMessageKey(value); return key ? t(key) : value; };
  function addCustom() {
    if (!custom.trim() || values.length >= 20) return;
    onValueChange(canonicalCategories([...values, custom.trim()]));
    setCustom("");
  }
  return <div ref={root} className="field category-field" onKeyDown={event => { if (event.key === "Escape" && open) { event.preventDefault(); event.stopPropagation(); setOpen(false); trigger.current?.focus(); } }}>
    <span>{t("itemCategories")}</span>
    <button ref={trigger} className="category-trigger" type="button" aria-expanded={open} onClick={() => setOpen(value => !value)}>{t("selectCategories")}<ChevronDown size={16} aria-hidden="true"/></button>
    <div className="category-selection">{values.map(value => <span className="category-chip" key={value}>{label(value)}<button type="button" className="icon-button" aria-label={t("removeCategory", { category: label(value) })} onClick={() => onValueChange(values.filter(entry => entry !== value))}><X size={13} aria-hidden="true"/></button><input type="hidden" name="categories" value={value}/></span>)}</div>
    {open ? <div className="category-picker category-popover">
      <div className="category-options" role="group" aria-label={t("itemCategories")}>{categories.map(value => <label key={value}><input type="checkbox" checked={values.includes(value)} disabled={!values.includes(value) && values.length >= 20} onChange={event => onValueChange(event.target.checked ? [...values, value] : values.filter(entry => entry !== value))}/><span aria-hidden="true">{categoryEmoji[value]}</span>{label(value)}</label>)}</div>
      <div className="custom-category-row"><input aria-label={t("customCategory")} maxLength={80} value={custom} placeholder={t("customCategoryPlaceholder")} onChange={event => setCustom(event.target.value)} onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); addCustom(); } }}/><button className="quiet-button" type="button" disabled={!custom.trim() || values.length >= 20} onClick={addCustom}>{t("addCategory")}</button></div>
    </div> : null}
  </div>;
}
