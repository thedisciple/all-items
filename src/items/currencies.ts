import { z } from "zod";
import type { Locale, MessageKey } from "@/i18n/messages";

// SIX ISO 4217 List One, published 2026-09-17, verified 2026-10-30.
// Runtime CLDR display defaults (notably HUF) must never reinterpret stored money.
export const currencyMinorUnits = {RSD:2,UAH:2,CNY:2,RUB:2,USD:2,EUR:2,GBP:2,HUF:2,CHF:2,CAD:2,AUD:2,JPY:0,KWD:3} as const;
export type CurrencyCode = keyof typeof currencyMinorUnits;
export const currencyCodes = Object.keys(currencyMinorUnits) as CurrencyCode[];
export const currencyCode = z.string().regex(/^[A-Z]{3}$/);
export const isSupportedCurrency = (code: string): code is CurrencyCode => (currencyCodes as readonly string[]).includes(code);
export const suggestedCurrency = (locale: Locale): CurrencyCode => ({ ru: "RUB", en: "USD", uk: "UAH", "sr-Latn": "RSD", "zh-Hans": "CNY" } as const)[locale];
export const currencyMessageKey = (code: CurrencyCode): MessageKey => `currency${code}`;

export function orderedCurrencies(locale: Locale) {
  return [...new Set([suggestedCurrency(locale), "USD", "EUR", "GBP", ...[...currencyCodes].sort()])] as CurrencyCode[];
}

export function currencyDigits(code: string) {
  return isSupportedCurrency(code) ? currencyMinorUnits[code] : 2;
}

// Decimal strings are converted with integer arithmetic, never rounded from binary floats.
export function parsePriceMinor(value: string | undefined, code: string, exponent: number = currencyDigits(code)): number | null {
  const text = z.string().trim().max(32).parse(value ?? "");
  if (!text) return null;
  z.string().trim().min(1).max(80).parse(code);
  const normalized = text.replace(",", ".").replace(/^\./, "0.");
  const match = /^(\d{1,9})(?:\.(\d{0,6}))?$/.exec(normalized);
  if (!match) throw new Error("Invalid asking price");
  const digits = z.number().int().min(0).max(3).parse(exponent);
  const fraction = match[2] ?? "";
  if (/[^0]/.test(fraction.slice(digits))) throw new Error("Invalid currency precision");
  const minor = Number(match[1]) * 10 ** digits + Number(fraction.slice(0, digits).padEnd(digits, "0"));
  if (!Number.isSafeInteger(minor) || minor < 0) throw new Error("Invalid asking price");
  return minor;
}

export function validPrice(value: string, code: string, exponent?: number) {
  try { parsePriceMinor(value, code, exponent); return true; } catch { return false; }
}

export function priceDecimal(minor: number, code: string | null, exponent?: number) {
  const digits = z.number().int().min(0).max(3).parse(exponent ?? (code ? currencyDigits(code) : 2));
  const text = String(z.number().int().nonnegative().safe().parse(minor)).padStart(digits + 1, "0");
  return digits ? `${text.slice(0, -digits)}.${text.slice(-digits)}` : text;
}
