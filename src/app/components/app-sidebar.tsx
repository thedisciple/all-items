"use client";

import { useInventory } from "./inventory-provider";
import Link from "next/link";
import { Boxes, Database, LibraryBig } from "lucide-react";
import { type Locale, translate } from "@/i18n/messages";

export function AppSidebar({ active, locale }: { active: "items" | "collections" | "data" | "settings"; locale: Locale }) {
  const { base, counts, sidebar } = useInventory();
  const t = (key: Parameters<typeof translate>[1]) => translate(locale,key);
  return <aside className="sidebar" data-collapsed={sidebar.collapsed} data-animate={sidebar.animate}>
    <div className="sidebar-heading"><Link className="brand" href={base} aria-label={`All Items — ${t("inventory")}`}><span className="brand-mark" aria-hidden="true">A</span><span className="brand-text">All Items</span></Link>
    </div>
    <nav id="sidebar-navigation" className="side-navigation" aria-label={t("primaryNavigation")}>
      <Link className={`nav-link ${active === "items" ? "active" : ""}`} aria-label={`${t("inventory")} ${new Intl.NumberFormat(locale).format(counts.items)}`} title={t("inventory")} href={base}><Boxes size={15} aria-hidden="true"/><span className="nav-label">{t("inventory")}</span><span className="nav-count">{new Intl.NumberFormat(locale).format(counts.items)}</span></Link>
      <Link className={`nav-link ${active === "collections" ? "active" : ""}`} aria-label={`${t("collections")} ${new Intl.NumberFormat(locale).format(counts.collections)}`} title={t("collections")} href={`${base}/collections`}><LibraryBig size={15} aria-hidden="true"/><span className="nav-label">{t("collections")}</span><span className="nav-count">{new Intl.NumberFormat(locale).format(counts.collections)}</span></Link>
      <Link className={`nav-link ${active === "data" ? "active" : ""}`} title={t("data")} aria-label={t("data")} href={`${base}/data`}><Database size={15} aria-hidden="true"/><span className="nav-label">{t("data")}</span></Link>
    </nav>
  </aside>;
}
