import Link from "next/link";
import { inventoryPath } from "@/items/inventory-context";
import { AppSidebar } from "@/app/components/app-sidebar";
import { DeleteInventoryControl,RenameInventoryControl,InventorySortControl } from "@/app/components/inventory-controls";
import { routeInventory } from "@/app/inventory-routing";
import { inventoryCounts } from "@/items/inventories";
import { AppHeader } from "@/app/components/app-header";
import { getLocale } from "@/i18n/server";
import { translate } from "@/i18n/messages";

export const dynamic = "force-dynamic";
export default async function InventorySettings({params}:{params:Promise<{inventoryId:string}>}) {
  const context=await routeInventory((await params).inventoryId);
  const counts=await inventoryCounts(context);
  const locale=await getLocale();
  return <main className="app-shell"><AppSidebar active="settings" locale={locale}/><section className="main-content"><AppHeader/><div className="content-wrap"><Link className="settings-back" href={inventoryPath(context)}>← {translate(locale,"inventory")}</Link><h1>{translate(locale,"inventoryManage")}</h1><RenameInventoryControl/><InventorySortControl/><DeleteInventoryControl counts={counts}/></div></section></main>;
}
