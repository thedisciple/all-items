import { AppSidebar } from "@/app/components/app-sidebar";
import { RenameInventoryControl } from "@/app/components/inventory-controls";
import { LanguageSwitcher } from "@/app/components/language-switcher";
import { getLocale } from "@/i18n/server";
import { translate } from "@/i18n/messages";

export const dynamic = "force-dynamic";
export default async function InventorySettings() {
  const locale=await getLocale();
  return <main className="app-shell"><AppSidebar active="items" locale={locale}/><section className="main-content"><header className="topbar"><span>{translate(locale,"inventoryManage")}</span><LanguageSwitcher/></header><div className="content-wrap"><h1>{translate(locale,"inventoryManage")}</h1><RenameInventoryControl/></div></section></main>;
}
