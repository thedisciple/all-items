"use client";

import { InventorySwitcher } from "./inventory-controls";
import { LanguageSwitcher } from "./language-switcher";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useInventory } from "./inventory-provider";
import { useI18n } from "@/i18n/provider";
import {AccountMenu} from "./account-menu";

export function AppHeader({ children }: { children?: React.ReactNode }) {
  const { sidebar,account } = useInventory();
  const { t } = useI18n();
  const label = t(sidebar.collapsed ? "sidebarExpand" : "sidebarCollapse");
  return <header className="topbar"><div className="header-location"><button type="button" className="icon-button header-sidebar-toggle" aria-label={label} title={label} aria-expanded={!sidebar.collapsed} aria-controls="sidebar-navigation" onClick={sidebar.toggle}>{sidebar.collapsed ? <PanelLeftOpen size={18} aria-hidden="true"/> : <PanelLeftClose size={18} aria-hidden="true"/>}</button><InventorySwitcher/>{children}</div><div className="account-controls"><AccountMenu username={account.username}/><LanguageSwitcher/></div></header>;
}
