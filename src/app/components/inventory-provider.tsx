"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { rememberInventoryAction } from "@/app/inventory-actions";
import type { Inventory } from "@/items/inventories";
import { inventoryPath } from "@/items/inventory-context";
import type { Presentation } from "@/items/inventory-presentation";

type Counts = { items: number; collections: number };
type PresentationState = { preferences: { version: 1; sort: "date" | "name" | "quantity" }; categories: Presentation[] };
type Value = { sidebar: { collapsed: boolean; animate: boolean; toggle: () => void }; inventory: Inventory; inventories: Inventory[]; counts: Counts; base: string; presentation: PresentationState };
const Context = createContext<Value | null>(null);

export function InventoryProvider({ inventory, inventories, counts, presentation, children, initialSidebarCollapsed = false }: { initialSidebarCollapsed?: boolean; inventory: Inventory; inventories: Inventory[]; counts: Counts; presentation: PresentationState; children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(initialSidebarCollapsed);
  const [animate, setAnimate] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  function toggleSidebar() {
    const next = !collapsed; setCollapsed(next); setAnimate(true);
    try { document.cookie = `all-items-sidebar=${next ? "collapsed" : "expanded"}; Path=/; Max-Age=31536000; SameSite=Lax`; } catch { /* The in-memory preference remains usable. */ }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setAnimate(false), 180);
  }
  useEffect(() => { void rememberInventoryAction(inventory.workspaceId).catch(() => {}); }, [inventory.workspaceId]);
  return <Context.Provider value={{ sidebar: { collapsed, animate, toggle: toggleSidebar }, inventory, inventories, counts, presentation, base: inventoryPath(inventory) }}>{children}</Context.Provider>;
}

export function useInventory() {
  const value = useContext(Context);
  if (!value) throw new Error("An explicit inventory route context is required");
  return value;
}

export function InventoryField() {
  const { inventory } = useInventory();
  return <input type="hidden" name="inventoryId" value={inventory.workspaceId}/>;
}
