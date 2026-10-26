import { AppSidebar } from "@/app/components/app-sidebar";
import { DeleteInventoryControl,RenameInventoryControl } from "@/app/components/inventory-controls";
import { routeInventory } from "@/app/inventory-routing";
import { inventoryCounts } from "@/items/inventories";
import { LanguageSwitcher } from "@/app/components/language-switcher";
import { getLocale } from "@/i18n/server";
import { translate } from "@/i18n/messages";

export const dynamic = "force-dynamic";
export default async function InventorySettings({params}:{params:Promise<{inventoryId:string}>}) {
  const context=await routeInventory((await params).inventoryId);
  const counts=await inventoryCounts(context);
  const locale=await getLocale();
  return <main className="app-shell"><AppSidebar active="items" locale={locale}/><section className="main-content"><header className="topbar"><span>{context.name}</span><LanguageSwitcher/></header><div className="content-wrap"><h1>{translate(locale,"inventoryManage")}</h1><RenameInventoryControl/><DeleteInventoryControl counts={counts}/></div></section></main>;
}
