"use client";

import { useState } from "react";
import { categories, categoryEmoji, categoryKeyForStoredValue, categoryMessageKey } from "@/items/categories";
import { useI18n } from "@/i18n/provider";

export function CategoryField({ value = "", name = "category", onValueChange }: { value?: string; name?: string; onValueChange?: (value: string) => void }) {
  const { t } = useI18n();
  const initialKey = categoryKeyForStoredValue(value);
  const [selection, setSelection] = useState(initialKey ?? (value ? "__custom" : ""));
  const [customValue, setCustomValue] = useState(initialKey ? "" : value);
  const categoryKeys = categories.map((key) => categoryMessageKey(key)!);

  return <label className="field">
    <span>{t("category")}</span>
    <select aria-label={t("category")} value={selection} onChange={(event) => { setSelection(event.target.value); onValueChange?.(event.target.value === "__custom" ? customValue : event.target.value); }}>
      <option value="">{t("selectCategory")}</option>
      {categories.map((key, index) => <option key={key} value={key}>{categoryEmoji[key]} {t(categoryKeys[index])}</option>)}
      <option value="__custom">{t("categoryCustom")}</option>
    </select>
    {selection === "__custom" ? <input aria-label={t("customCategory")} maxLength={80} value={customValue} placeholder={t("customCategoryPlaceholder")} onChange={(event) => { setCustomValue(event.target.value); onValueChange?.(event.target.value); }}/> : null}
    <input type="hidden" name={name} value={selection === "__custom" ? customValue : selection}/>
  </label>;
}
