import Link from "next/link";
import { Boxes, Database, LibraryBig } from "lucide-react";
import { type Locale, translate } from "@/i18n/messages";

export function AppSidebar({ active, itemCount, collectionCount, locale }: { active: "items" | "collections" | "data"; itemCount?: number; collectionCount?: number; locale: Locale }) {
  return <aside className="sidebar">
    <Link className="brand" href="/" aria-label={`All Items — ${translate(locale, "inventory")}`}><span className="brand-mark" aria-hidden="true">A</span><span>All Items</span></Link>
    <nav className="side-navigation" aria-label={translate(locale, "primaryNavigation")}>
      <Link className={`nav-link ${active === "items" ? "active" : ""}`} href="/"><Boxes size={15} aria-hidden="true"/>{translate(locale, "inventory")}{itemCount === undefined ? null : <span className="nav-count">{new Intl.NumberFormat(locale).format(itemCount)}</span>}</Link>
      <Link className={`nav-link ${active === "collections" ? "active" : ""}`} href="/collections"><LibraryBig size={15} aria-hidden="true"/>{translate(locale, "collections")}{collectionCount === undefined ? null : <span className="nav-count">{new Intl.NumberFormat(locale).format(collectionCount)}</span>}</Link>
      <Link className={`nav-link ${active === "data" ? "active" : ""}`} href="/data"><Database size={15} aria-hidden="true"/>{translate(locale, "data")}</Link>
    </nav>
  </aside>;
}
