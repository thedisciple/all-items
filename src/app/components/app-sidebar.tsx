"use client";

import { useInventory } from "./inventory-provider";
import { Boxes, LibraryBig } from "lucide-react";
import { type Locale, translate } from "@/i18n/messages";
import Link from "next/link";
import {AppBrand} from "./app-brand";

export function AppSidebar({ active, locale }: { active: "items" | "collections" | "data" | "settings"; locale: Locale }) {
  const { base, counts, sidebar } = useInventory();
  const t = (key: Parameters<typeof translate>[1]) => translate(locale,key);
  return <aside className="sidebar" data-collapsed={sidebar.collapsed} data-animate={sidebar.animate}>
    <div className="sidebar-heading"><AppBrand href={base} label={`All Items — ${t("inventory")}`}/>
    </div>
    <nav id="sidebar-navigation" className="side-navigation" aria-label={t("primaryNavigation")}>
      <Link className={`nav-link ${active === "items" ? "active" : ""}`} aria-current={active==="items"?"page":undefined} aria-label={`${t("inventory")} ${new Intl.NumberFormat(locale).format(counts.items)}`} title={t("inventory")} href={base}><Boxes size={15} aria-hidden="true"/><span className="nav-label">{t("inventory")}</span><span className="nav-count">{new Intl.NumberFormat(locale).format(counts.items)}</span></Link>
      <Link className={`nav-link ${active === "collections" ? "active" : ""}`} aria-current={active==="collections"?"page":undefined} aria-label={`${t("collections")} ${new Intl.NumberFormat(locale).format(counts.collections)}`} title={t("collections")} href={`${base}/collections`}><LibraryBig size={15} aria-hidden="true"/><span className="nav-label">{t("collections")}</span><span className="nav-count">{new Intl.NumberFormat(locale).format(counts.collections)}</span></Link>
    </nav>
  </aside>;
}
