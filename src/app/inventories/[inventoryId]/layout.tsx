import { InventoryProvider } from "@/app/components/inventory-provider";
import { routeInventory } from "@/app/inventory-routing";
import { inventoryCounts, listInventories } from "@/items/inventories";
import { getInventoryPresentation } from "@/items/inventory-presentation";

export const dynamic = "force-dynamic";
export default async function InventoryLayout({ params, children }: { params: Promise<{ inventoryId: string }>; children: React.ReactNode }) {
  const inventory = await routeInventory((await params).inventoryId);
  const [inventories, counts, presentation] = await Promise.all([listInventories(), inventoryCounts(inventory), getInventoryPresentation(inventory)]);
  return <InventoryProvider key={inventory.workspaceId} inventory={inventory} inventories={inventories} counts={counts} presentation={presentation}>{children}</InventoryProvider>;
}
