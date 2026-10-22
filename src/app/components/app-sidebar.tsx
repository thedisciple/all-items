import Link from "next/link";
import { Boxes, LibraryBig } from "lucide-react";

export function AppSidebar({ active, itemCount, collectionCount }: { active: "items" | "collections"; itemCount?: number; collectionCount?: number }) {
  return <aside className="sidebar">
    <Link className="brand" href="/" aria-label="Все вещи — главная"><span className="brand-mark">в</span><span>все вещи<span className="brand-period">.</span></span></Link>
    <div className="side-label">МОЯ ОПИСЬ</div>
    <nav className="side-navigation" aria-label="Основная навигация">
      <Link className={`nav-link ${active === "items" ? "active" : ""}`} href="/"><Boxes size={15} aria-hidden="true"/>Все вещи{itemCount === undefined ? null : <span className="nav-count">{itemCount}</span>}</Link>
      <Link className={`nav-link ${active === "collections" ? "active" : ""}`} href="/collections"><LibraryBig size={15} aria-hidden="true"/>Коллекции{collectionCount === undefined ? null : <span className="nav-count">{collectionCount}</span>}</Link>
    </nav>
    <div className="sidebar-bottom"><span className="status-dot"/>Локальное хранилище<div className="privacy-note">Данные остаются на этом устройстве</div></div>
  </aside>;
}
