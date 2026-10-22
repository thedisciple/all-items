import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, LibraryBig } from "lucide-react";
import { AppSidebar } from "@/app/components/app-sidebar";
import { CreateCollectionForm } from "@/app/components/collection-forms";
import { getLocale } from "@/i18n/server";
import { formatCollectionCount, formatItemCount, translate } from "@/i18n/messages";
import { listCollections } from "@/items/collections";
import { LanguageSwitcher } from "@/app/components/language-switcher";

export const dynamic = "force-dynamic";

export default async function CollectionsPage() {
  const [locale, collections] = await Promise.all([getLocale(), listCollections()]);
  const t = (key: Parameters<typeof translate>[1]) => translate(locale, key);
  return <main className="app-shell">
    <AppSidebar active="collections" collectionCount={collections.length} locale={locale}/>
    <section className="main-content">
      <header className="topbar"><span>{t("collections")}</span><LanguageSwitcher/></header>
      <div className="content-wrap"><div className="heading-row"><h1>{t("collections")}</h1><span className="total-count">{formatCollectionCount(locale, collections.length)}</span></div>
        <div className="collection-create-toolbar"><CreateCollectionForm/></div>
        {collections.length ? <div className="list-heading"><h2>{t("collectionsYour")}</h2></div> : null}
        {collections.length ? <div className="collection-grid">{collections.map((collection) => <Link href={`/collections/${collection.id}`} className="collection-card" key={collection.id}>
          {collection.coverType === "item_photo" && collection.coverItemId && collection.coverMediaId ? <Image className="collection-card-image" src={`/media/${collection.coverItemId}/${collection.coverMediaId}?variant=thumbnail`} alt="" width={320} height={200} unoptimized/> : collection.coverType === "upload" && collection.coverUploadId ? <Image className="collection-card-image" src={`/media/collections/${collection.id}/${collection.coverUploadId}?variant=thumbnail`} alt="" width={320} height={200} unoptimized/> : <div className="collection-card-placeholder" aria-hidden="true">{collection.coverType === "emoji" && collection.coverIcon ? <span>{collection.coverIcon}</span> : collection.icon ? <span>{collection.icon}</span> : <LibraryBig size={25}/>}</div>}
          <div className="collection-card-content"><div><h3>{collection.icon && collection.coverType !== "emoji" ? <span className="collection-title-icon" aria-hidden="true">{collection.icon} </span> : null}{collection.name}</h3><p>{formatItemCount(locale, Number(collection.itemCount))}</p></div><ArrowUpRight size={17} aria-hidden="true"/></div>
        </Link>)}</div> : <div className="empty-state collection-empty"><div className="empty-orbit"><LibraryBig size={18} aria-hidden="true"/></div><h3>{t("collectionEmpty")}</h3></div>}
      </div>
    </section>
  </main>;
}
