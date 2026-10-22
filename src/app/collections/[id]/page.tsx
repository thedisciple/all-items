import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { AppSidebar } from "@/app/components/app-sidebar";
import { CollectionManageForms } from "@/app/components/collection-forms";
import { listCollections, getCollection } from "@/items/collections";
import { listItems } from "@/items/service";
import { getLocale } from "@/i18n/server";
import { formatItemCount, translate } from "@/i18n/messages";
import { categories, categoryMessageKey } from "@/items/categories";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ q?: string; category?: string; status?: string; sort?: string }> };
export default async function CollectionPage({ params, searchParams }: Props) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const parsedId = z.uuid().safeParse(id);
  if (!parsedId.success) notFound();
  const collection = await getCollection(parsedId.data);
  if (!collection) notFound();
  const [locale, collections, items] = await Promise.all([
    getLocale(),
    listCollections(),
    listItems({ collectionId: id, search: query.q, category: query.category || undefined, status: query.status || undefined, sort: query.sort }),
  ]);
  const t = (key: Parameters<typeof translate>[1], values?: Record<string, string | number>) => translate(locale, key, values);
  const statuses: Record<string, string> = { unknown: t("itemStatusUnknown"), user_confirmed: t("itemStatusConfirmed"), source_verified: t("itemStatusVerified") };
  return <main className="app-shell"><AppSidebar active="collections" collectionCount={collections.length} locale={locale}/>
    <section className="main-content"><header className="topbar"><div className="breadcrumb"><Link href="/collections">{t("collections")}</Link><span>/</span>{String(collection.name)}</div></header>
      <div className="content-wrap"><div className="heading-row"><div><h1>{String(collection.name)}</h1><p className="subtitle">{formatItemCount(locale, Number(collection.itemCount))} · {t("collectionSharedInventory")}</p></div><Link href="/" className="quiet-button link-button">{t("collectionViewAll")}</Link></div>
        <CollectionManageForms id={id} name={String(collection.name)}/>
        <form className="filter-bar collection-filter" method="get"><label className="search-field"><span aria-hidden="true">⌕</span><input name="q" defaultValue={query.q} placeholder={t("collectionItemsSearch")} maxLength={160}/></label><select name="category" defaultValue={query.category ?? ""}><option value="">{t("categoriesAll")}</option>{categories.map((category) => <option key={category} value={category}>{t(categoryMessageKey(category)!)}</option>)}</select><select name="status" defaultValue={query.status ?? ""}><option value="">{t("statusAny")}</option>{Object.entries(statuses).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select><select name="sort" defaultValue={query.sort ?? "date"}><option value="date">{t("sortNewest")}</option><option value="name">{t("sortName")}</option><option value="quantity">{t("sortQuantity")}</option></select><button className="quiet-button">{t("search")}</button></form>
        <div className="list-heading"><div><h2>{t("collectionItems")}</h2></div><span className="list-total">{t("resultCount", { count: items.length })}</span></div>
        {items.length ? <div className="item-list">{items.map((item) => { const categoryKey = item.category ? categoryMessageKey(String(item.category)) : null; return <Link href={`/items/${item.id}`} className="item-row" key={String(item.id)}>{item.primary_media_id ? <Image className="item-photo" src={`/media/${item.id}/${item.primary_media_id}?variant=thumbnail`} alt="" width={80} height={80} unoptimized/> : <div className="item-thumb"><span>{t("photo")}</span></div>}<div className="item-info"><h3>{String(item.name)}</h3><div className="item-meta"><span className="inventory-number">{String(item.inventory_number)}</span>{item.model ? <span>{String(item.model)}</span> : null}{item.category ? <span className="category-name">{categoryKey ? t(categoryKey) : String(item.category)}</span> : null}<span>{t("quantity")}: {new Intl.NumberFormat(locale).format(Number(item.quantity))}</span><span>{t("locations")}: {String(item.locations || t("locationUnknown"))}</span></div></div><span className="item-index">{statuses[String(item.identification_status)]}</span></Link>; })}</div> : <div className="empty-state"><div className="empty-orbit">✳</div><h3>{query.q ? t("noMatches") : t("collectionNoItems")}</h3><p>{query.q ? t("adjustFilters") : t("collectionMembershipEmpty")}</p><Link className="quiet-button link-button" href="/">{t("collectionViewAll")}</Link></div>}
      </div>
    </section>
  </main>;
}
