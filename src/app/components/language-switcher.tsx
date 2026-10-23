"use client";

import { useEffect, useRef, useState, useTransition, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { setLanguageAction } from "@/app/actions";
import { useI18n } from "@/i18n/provider";
import { type Locale, type MessageKey } from "@/i18n/messages";

const languageLabels: Record<Locale, MessageKey> = { ru: "languageRussian", en: "languageEnglish", uk: "languageUkrainian", "sr-Latn": "languageSerbian", "zh-Hans": "languageChinese" };
const flagFiles: Record<Locale, string> = { ru: "ru", en: "gb", uk: "uk", "sr-Latn": "rs", "zh-Hans": "cn" };

export function LanguageSwitcher() {
  const { locale, t } = useI18n();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => { if (!rootRef.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, [open]);
  const choose = (value: Locale) => {
    setOpen(false);
    triggerRef.current?.focus();
    if (value === locale) return;
    const formData = new FormData();
    formData.set("locale", value);
    startTransition(async () => { await setLanguageAction(formData); router.refresh(); });
  };
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") { setOpen(false); triggerRef.current?.focus(); return; }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const options = Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>("button") ?? []);
      const index = options.indexOf(document.activeElement as HTMLButtonElement);
      options[(index + (event.key === "ArrowDown" ? 1 : options.length - 1)) % options.length]?.focus();
    }
  };
  return <div ref={rootRef} className="language-switcher-wrap" onKeyDown={onKeyDown}>
    <button ref={triggerRef} className="language-switcher" type="button" aria-label={t("language")} aria-haspopup="menu" aria-expanded={open} disabled={pending} onClick={() => setOpen((value) => !value)}>
      <img src={`/flags/${flagFiles[locale]}.svg`} alt="" width="20" height="15"/>
      <span>{t(languageLabels[locale])}</span><ChevronDown size={15} aria-hidden="true"/>
    </button>
    {open ? <div className="language-menu" role="menu" aria-label={t("language")} ref={menuRef}>
      <button type="button" role="menuitemradio" aria-checked={locale === "ru"} onClick={() => choose("ru")}><img src="/flags/ru.svg" alt="" width="20" height="15"/>{t("languageRussian")}</button>
      <button type="button" role="menuitemradio" aria-checked={locale === "en"} onClick={() => choose("en")}><img src="/flags/gb.svg" alt="" width="20" height="15"/>{t("languageEnglish")}</button>
      <button type="button" role="menuitemradio" aria-checked={locale === "uk"} onClick={() => choose("uk")}><img src="/flags/uk.svg" alt="" width="20" height="15"/>{t("languageUkrainian")}</button>
      <button type="button" role="menuitemradio" aria-checked={locale === "sr-Latn"} onClick={() => choose("sr-Latn")}><img src="/flags/rs.svg" alt="" width="20" height="15"/>{t("languageSerbian")}</button>
      <button type="button" role="menuitemradio" aria-checked={locale === "zh-Hans"} onClick={() => choose("zh-Hans")}><img src="/flags/cn.svg" alt="" width="20" height="15"/>{t("languageChinese")}</button>
    </div> : null}
  </div>;
}
