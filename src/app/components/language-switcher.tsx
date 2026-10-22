"use client";

import { useEffect, useRef, useState, useTransition, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { setLanguageAction } from "@/app/actions";
import { useI18n } from "@/i18n/provider";

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
  const choose = (value: "ru" | "en") => {
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
      <img src={locale === "ru" ? "/flags/ru.svg" : "/flags/gb.svg"} alt="" width="20" height="15"/>
      <span>{locale === "ru" ? t("languageRussian") : t("languageEnglish")}</span><span aria-hidden="true">⌄</span>
    </button>
    {open ? <div className="language-menu" role="menu" aria-label={t("language")} ref={menuRef}>
      <button type="button" role="menuitemradio" aria-checked={locale === "ru"} onClick={() => choose("ru")}><img src="/flags/ru.svg" alt="" width="20" height="15"/>{t("languageRussian")}</button>
      <button type="button" role="menuitemradio" aria-checked={locale === "en"} onClick={() => choose("en")}><img src="/flags/gb.svg" alt="" width="20" height="15"/>{t("languageEnglish")}</button>
    </div> : null}
  </div>;
}
