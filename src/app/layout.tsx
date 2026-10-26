import { translate } from "@/i18n/messages";
import type { Metadata } from "next";
import { getLocale } from "@/i18n/server";
import { I18nProvider } from "@/i18n/provider";
import "cropperjs/dist/cropper.css";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return { title: "All Items", description: translate(locale,"appDescription"), icons: { icon: "/favicon.svg" } };
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const locale = await getLocale();
  return <html lang={locale}><body><I18nProvider locale={locale}>{children}</I18nProvider></body></html>;
}
