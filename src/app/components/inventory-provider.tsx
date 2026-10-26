"use client";

import { createContext, useContext, useEffect } from "react";
import { rememberInventoryAction } from "@/app/inventory-actions";
import type { Inventory } from "@/items/inventories";
import { inventoryPath } from "@/items/inventory-context";

type Counts = { items: number; collections: number };
type Value = { inventory: Inventory; inventories: Inventory[]; counts: Counts; base: string };
const Context = createContext<Value | null>(null);

export function InventoryProvider({ inventory, inventories, counts, children }: { inventory: Inventory; inventories: Inventory[]; counts: Counts; children: React.ReactNode }) {
  useEffect(() => { void rememberInventoryAction(inventory.workspaceId).catch(() => {}); }, [inventory.workspaceId]);
  return <Context.Provider value={{ inventory, inventories, counts, base: inventoryPath(inventory) }}>{children}</Context.Provider>;
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
