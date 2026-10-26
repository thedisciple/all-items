import { redirect } from "next/navigation";
import { preferredInventory } from "@/app/inventory-routing";
import { inventoryPath } from "@/items/inventory-context";
import { CreateInventoryControl } from "@/app/components/inventory-controls";
import { LanguageSwitcher } from "@/app/components/language-switcher";
import { getLocale } from "@/i18n/server";
import { translate } from "@/i18n/messages";
export const dynamic="force-dynamic";
export default async function Home({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}) {
 const context=await preferredInventory();
 if(context) { const query=new URLSearchParams(); for(const [key,value] of Object.entries(await searchParams)) if(typeof value==="string" && ["q","category","status","sort","added","updated"].includes(key)) query.set(key,value); redirect(inventoryPath(context)+(query.size?`?${query}`:"")); }
 const locale=await getLocale();
 return <main className="content-wrap"><header className="topbar"><span className="brand">All Items</span><LanguageSwitcher/></header><h1>{translate(locale,"inventoryEmptyInstallation")}</h1><CreateInventoryControl/></main>;
}
