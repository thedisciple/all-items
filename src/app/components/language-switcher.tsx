"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { setLanguageAction } from "@/app/actions";
import { useI18n } from "@/i18n/provider";

export function LanguageSwitcher() {
  const { locale, t } = useI18n();
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  return <select className="language-switcher" aria-label={t("language")} value={locale} disabled={pending} onChange={(event) => {
    const formData = new FormData();
    formData.set("locale", event.currentTarget.value);
    startTransition(async () => { await setLanguageAction(formData); router.refresh(); });
  }}>
    <option value="ru">🇷🇺 {t("languageRussian")}</option><option value="en">🇬🇧 {t("languageEnglish")}</option>
  </select>;
}
