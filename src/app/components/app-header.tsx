"use client";

import { InventorySwitcher } from "./inventory-controls";
import { LanguageSwitcher } from "./language-switcher";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useInventory } from "./inventory-provider";
import { useI18n } from "@/i18n/provider";

export function AppHeader({ children }: { children?: React.ReactNode }) {
  const { sidebar } = useInventory();
  const { t } = useI18n();
  const label = t(sidebar.collapsed ? "sidebarExpand" : "sidebarCollapse");
  return <header className="topbar"><div className="header-location"><button type="button" className="icon-button header-sidebar-toggle" aria-label={label} title={label} aria-expanded={!sidebar.collapsed} aria-controls="sidebar-navigation" onClick={sidebar.toggle}>{sidebar.collapsed ? <PanelLeftOpen size={18} aria-hidden="true"/> : <PanelLeftClose size={18} aria-hidden="true"/>}</button><InventorySwitcher/>{children}</div><LanguageSwitcher/></header>;
}
