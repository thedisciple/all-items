import { routeInventory } from "@/app/inventory-routing";
import { inventoryPath } from "@/items/inventory-context";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { AppSidebar } from "@/app/components/app-sidebar";
import { CreateCollectionForm } from "@/app/components/collection-forms";
import { getLocale } from "@/i18n/server";
import { formatCollectionCount, formatItemCount, translate } from "@/i18n/messages";
import { listCollections } from "@/items/collections";
import { AppHeader } from "@/app/components/app-header";
import { CollectionCoverVisual } from "@/app/components/collection-cover-visual";
import { LibraryBig } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function CollectionsPage({params}: {params:Promise<{inventoryId:string}>}) {
  const context = await routeInventory((await params).inventoryId);
  const base = inventoryPath(context);
  const [locale, collections] = await Promise.all([getLocale(), listCollections(context)]);
  const t = (key: Parameters<typeof translate>[1]) => translate(locale, key);
  return <main className="app-shell">
    <AppSidebar active="collections" collectionCount={collections.length} locale={locale}/>
    <section className="main-content">
      <AppHeader/>
      <div className="content-wrap"><div className="heading-row"><h1>{t("collections")}</h1><span className="total-count">{formatCollectionCount(locale, collections.length)}</span></div>
        <div className="collection-create-toolbar"><CreateCollectionForm/></div>
        {collections.length ? <div className="list-heading"><h2>{t("collectionsYour")}</h2></div> : null}
        {collections.length ? <div className="collection-grid">{collections.map((collection) => <Link href={`${base}/collections/${collection.id}`} className="collection-card" key={collection.id}>
          <CollectionCoverVisual base={base} collection={collection} variant="card"/>
          <div className="collection-card-content"><div><h3>{collection.icon && !(collection.coverType === "emoji" && collection.coverIcon === collection.icon) ? <span className="collection-title-icon" aria-hidden="true">{collection.icon} </span> : null}{collection.name}</h3><p>{formatItemCount(locale, Number(collection.itemCount))}</p></div><ArrowUpRight size={17} aria-hidden="true"/></div>
        </Link>)}</div> : <div className="empty-state collection-empty"><div className="empty-orbit"><LibraryBig size={18} aria-hidden="true"/></div><h3>{t("collectionEmpty")}</h3></div>}
      </div>
    </section>
  </main>;
}
