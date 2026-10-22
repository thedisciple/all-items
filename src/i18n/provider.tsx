"use client";

import { createContext, useContext } from "react";
import { translate, type Locale, type MessageKey } from "./messages";

const I18nContext = createContext<{ locale: Locale; t: (key: MessageKey, values?: Record<string, string | number>) => string }>({
  locale: "ru", t: (key, values) => translate("ru", key, values),
});

export function I18nProvider({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  return <I18nContext.Provider value={{ locale, t: (key, values) => translate(locale, key, values) }}>{children}</I18nContext.Provider>;
}

export function useI18n() { return useContext(I18nContext); }
