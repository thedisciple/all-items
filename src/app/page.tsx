import { redirect } from "next/navigation";
import { preferredInventory } from "@/app/inventory-routing";
import { inventoryPath } from "@/items/inventory-context";
import { CreateInventoryControl } from "@/app/components/inventory-controls";
import { getLocale } from "@/i18n/server";
import { translate } from "@/i18n/messages";
import {pageUser} from "@/auth/request";
import {AccountMenu} from "@/app/components/account-menu";
import {AppBrand} from "@/app/components/app-brand";
import {Boxes,Database,LibraryBig} from "lucide-react";
export const dynamic="force-dynamic";
export default async function Home({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}) {
 const account=await pageUser();
 const context=await preferredInventory();
 if(context) { const query=new URLSearchParams(); for(const [key,value] of Object.entries(await searchParams)) if(typeof value==="string" && ["q","category","status","sort","added","updated"].includes(key)) query.set(key,value); redirect(inventoryPath(context)+(query.size?`?${query}`:"")); }
 const locale=await getLocale();
 const t=(key:Parameters<typeof translate>[1])=>translate(locale,key);
 return <main className="app-shell empty-account-shell">
   <aside className="sidebar"><div className="sidebar-heading"><AppBrand href="/" label="All Items"/></div>
     <nav className="side-navigation" aria-label={t("primaryNavigation")}>
       <span className="nav-link empty-nav-link" role="link" aria-disabled="true"><Boxes size={15} aria-hidden="true"/><span className="nav-label">{t("inventory")}</span></span>
       <span className="nav-link empty-nav-link" role="link" aria-disabled="true"><LibraryBig size={15} aria-hidden="true"/><span className="nav-label">{t("collections")}</span></span>
       <span className="nav-link empty-nav-link" role="link" aria-disabled="true"><Database size={15} aria-hidden="true"/><span className="nav-label">{t("data")}</span></span>
     </nav>
   </aside>
   <section className="main-content"><header className="topbar"><div className="account-controls"><AccountMenu username={account.username}/></div></header>
     <div className="content-wrap"><div className="empty-account-state"><h1>{t("inventoryEmptyInstallation")}</h1><CreateInventoryControl/></div></div>
   </section>
 </main>;
}
