import { cookies, headers } from "next/headers";
import { locales, type Locale } from "./messages";

const validLocales = new Set<string>(locales);

export function resolveLocale(stored: string | undefined, acceptLanguage: string | null): Locale {
  if (stored && validLocales.has(stored as Locale)) return stored as Locale;
  const accepted = acceptLanguage?.split(",").map((part) => part.split(";")[0]?.trim().toLowerCase()) ?? [];
  for (const language of accepted) {
    if (!language) continue;
    if (language.startsWith("zh")) return "zh-Hans";
    if (language.startsWith("sr")) return "sr-Latn";
    if (language.startsWith("uk")) return "uk";
    if (language.startsWith("en")) return "en";
    if (language.startsWith("ru")) return "ru";
  }
  return "ru";
}

export async function getLocale(): Promise<Locale> {
  const stored = (await cookies()).get("all-items-language")?.value;
  return resolveLocale(stored, (await headers()).get("accept-language"));
}
