"use client";

import { useInventory } from "./inventory-provider";
import Link from "next/link";
import { Boxes, Database, LibraryBig } from "lucide-react";
import { type Locale, translate } from "@/i18n/messages";

export function AppSidebar({ active, locale }: { active: "items" | "collections" | "data" | "settings"; itemCount?: number; collectionCount?: number; locale: Locale }) {
  const { base, counts } = useInventory();
  return <aside className="sidebar">
    <Link className="brand" href={base} aria-label={`All Items — ${translate(locale, "inventory")}`}><span className="brand-mark" aria-hidden="true">A</span><span>All Items</span></Link>
    <nav className="side-navigation" aria-label={translate(locale, "primaryNavigation")}>
      <Link className={`nav-link ${active === "items" ? "active" : ""}`} href={base}><Boxes size={15} aria-hidden="true"/>{translate(locale, "inventory")}<span className="nav-count">{new Intl.NumberFormat(locale).format(counts.items)}</span></Link>
      <Link className={`nav-link ${active === "collections" ? "active" : ""}`} href={`${base}/collections`}><LibraryBig size={15} aria-hidden="true"/>{translate(locale, "collections")}<span className="nav-count">{new Intl.NumberFormat(locale).format(counts.collections)}</span></Link>
      <Link className={`nav-link ${active === "data" ? "active" : ""}`} href={`${base}/data`}><Database size={15} aria-hidden="true"/>{translate(locale, "data")}</Link>
    </nav>
  </aside>;
}
