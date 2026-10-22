import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Все вещи — личная опись",
  description: "Локальная приватная опись ваших вещей.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ru"><body>{children}</body></html>;
}
