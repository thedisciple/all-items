import { InventoryProvider } from "@/app/components/inventory-provider";
import { routeInventory } from "@/app/inventory-routing";
import { listInventories } from "@/items/inventories";

export const dynamic = "force-dynamic";
export default async function InventoryLayout({ params, children }: { params: Promise<{ inventoryId: string }>; children: React.ReactNode }) {
  const inventory = await routeInventory((await params).inventoryId);
  return <InventoryProvider key={inventory.workspaceId} inventory={inventory} inventories={await listInventories()}>{children}</InventoryProvider>;
}
