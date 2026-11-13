"use client";

import { LockKeyhole } from "lucide-react";
import { currencyDigits, currencyMessageKey, isSupportedCurrency, orderedCurrencies, suggestedCurrency, validPrice } from "@/items/currencies";
import { useI18n } from "@/i18n/provider";
import {ChoicePicker} from "./choice-picker";

export function CurrencyFields({ price, currency, onPriceChange, onCurrencyChange, exponent }: { exponent?: number; price: string; currency: string; onPriceChange: (value: string) => void; onCurrencyChange: (value: string) => void }) {
  const { locale, t } = useI18n();
  const selected = currency || suggestedCurrency(locale);
  const digits = exponent ?? currencyDigits(selected);
  const invalid = !validPrice(price, selected, digits);
  return <>
    <label className="field"><span className="private-field-label"><LockKeyhole size={12} aria-hidden="true"/>{t("askingPrice")}</span><input type="text" inputMode="decimal" maxLength={32} name="askingPrice" value={price} aria-invalid={invalid} onChange={event => { onPriceChange(event.target.value); if (!currency && event.target.value.trim()) onCurrencyChange(selected); }}/>{invalid ? <small className="form-error">{t("currencyPriceInvalid", { currency: selected, digits })}</small> : null}</label>
    <div className="field"><span>{t("currency")}</span><ChoicePicker label={t("currency")} name="askingCurrency" value={selected} onChange={onCurrencyChange} options={[...(currency&&!isSupportedCurrency(currency)?[{value:currency,label:currency}]:[]),...orderedCurrencies(locale).map(code=>({value:code,label:code,description:t(currencyMessageKey(code))}))]}/></div>
  </>;
}
