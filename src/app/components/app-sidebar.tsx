import Link from "next/link";
import { Boxes, LibraryBig } from "lucide-react";
import { type Locale, translate } from "@/i18n/messages";
import { LanguageSwitcher } from "./language-switcher";

export function AppSidebar({ active, itemCount, collectionCount, locale }: { active: "items" | "collections"; itemCount?: number; collectionCount?: number; locale: Locale }) {
  return <aside className="sidebar">
    <Link className="brand" href="/" aria-label={`All Items — ${translate(locale, "allItems")}`}><span className="brand-mark" aria-hidden="true">A</span><span>All Items</span></Link>
    <nav className="side-navigation" aria-label={translate(locale, "primaryNavigation")}>
      <Link className={`nav-link ${active === "items" ? "active" : ""}`} href="/"><Boxes size={15} aria-hidden="true"/>{translate(locale, "allItems")}{itemCount === undefined ? null : <span className="nav-count">{itemCount}</span>}</Link>
      <Link className={`nav-link ${active === "collections" ? "active" : ""}`} href="/collections"><LibraryBig size={15} aria-hidden="true"/>{translate(locale, "collections")}{collectionCount === undefined ? null : <span className="nav-count">{collectionCount}</span>}</Link>
    </nav>
    <LanguageSwitcher/>
  </aside>;
}
