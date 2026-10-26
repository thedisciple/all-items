"use client";

import { InventorySwitcher } from "./inventory-controls";
import { LanguageSwitcher } from "./language-switcher";

export function AppHeader({ children }: { children?: React.ReactNode }) {
  return <header className="topbar"><div className="header-location"><InventorySwitcher/>{children}</div><LanguageSwitcher/></header>;
}
