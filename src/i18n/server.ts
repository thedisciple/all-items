import { cookies, headers } from "next/headers";
import { type Locale } from "./messages";

const validLocales = new Set<Locale>(["ru", "en"]);

export function resolveLocale(stored: string | undefined, acceptLanguage: string | null): Locale {
  if (stored && validLocales.has(stored as Locale)) return stored as Locale;
  const accepted = acceptLanguage?.split(",").map((part) => part.split(";")[0]?.trim().toLowerCase()) ?? [];
  const preferred = accepted.find((language) => language?.startsWith("en") || language?.startsWith("ru"));
  return preferred?.startsWith("en") ? "en" : "ru";
}

export async function getLocale(): Promise<Locale> {
  const stored = (await cookies()).get("all-items-language")?.value;
  return resolveLocale(stored, (await headers()).get("accept-language"));
}
