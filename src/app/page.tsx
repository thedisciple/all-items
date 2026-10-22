import Link from "next/link";
import Image from "next/image";
import { Search } from "lucide-react";
import { listCollections } from "@/items/collections";
import { AppSidebar } from "@/app/components/app-sidebar";
import { AddItemForm } from "@/app/components/add-item-form";
import { categories, categoryMessageKey } from "@/items/categories";
import { countItems, listItems } from "@/items/service";
import { getLocale } from "@/i18n/server";
import { formatItemCount, translate } from "@/i18n/messages";

export const dynamic = "force-dynamic";
type Props = { searchParams: Promise<{ q?: string; category?: string; status?: string; sort?: string }> };
export default async function Home({ searchParams }: Props) {
  const params = await searchParams;
  const [locale, items, collections, totalCount] = await Promise.all([
    getLocale(),
    listItems({ search: params.q, category: params.category || undefined, status: params.status || undefined, sort: params.sort }),
    listCollections(),
    countItems(),
  ]);
  const t = (key: Parameters<typeof translate>[1], values?: Record<string, string | number>) => translate(locale, key, values);
  const hasFilters = Boolean(params.q || params.category || params.status);
  const statusLabels: Record<string, string> = { unknown: t("itemStatusUnknown"), user_confirmed: t("itemStatusConfirmed"), source_verified: t("itemStatusVerified") };
  return <main className="app-shell">
    <AppSidebar active="items" itemCount={totalCount} collectionCount={collections.length} locale={locale}/>
    <section className="main-content">
      <div className="content-wrap"><div className="heading-row"><h1>{t("allItems")}</h1><span className="total-count">{formatItemCount(locale, totalCount)}</span></div>
        <AddItemForm/>
        <form className="filter-bar" method="get"><label className="search-field"><Search size={17} aria-hidden="true"/><input name="q" defaultValue={params.q} placeholder={t("searchItems")} maxLength={160}/></label><select name="category" defaultValue={params.category ?? ""}><option value="">{t("categoriesAll")}</option>{categories.map((key) => { const label = categoryMessageKey(key)!; return <option key={key} value={key}>{t(label)}</option>; })}</select><select name="status" defaultValue={params.status ?? ""}><option value="">{t("statusAny")}</option>{Object.entries(statusLabels).map(([key,value])=><option value={key} key={key}>{value}</option>)}</select><select name="sort" defaultValue={params.sort ?? "date"}><option value="date">{t("sortNewest")}</option><option value="name">{t("sortName")}</option><option value="quantity">{t("sortQuantity")}</option></select><button className="quiet-button">{t("search")}</button></form>
        <div className="list-heading"><h2>{t("inventory")}</h2><span className="list-total">{hasFilters ? t("resultCount", { count: items.length }) : formatItemCount(locale, totalCount)}</span></div>
        {items.length ? <div className="item-list">{items.map((item) => { const categoryKey = item.category ? categoryMessageKey(String(item.category)) : null; return <Link href={`/items/${item.id}`} className="item-row" key={String(item.id)}>{item.primary_media_id ? <Image className="item-photo" src={`/media/${item.id}/${item.primary_media_id}?variant=thumbnail`} alt="" width={80} height={80} unoptimized/> : <div className="item-thumb" aria-hidden="true"><span>{t("photo")}</span></div>}<div className="item-info"><h3>{String(item.name)}</h3><div className="item-meta"><span className="inventory-number">{String(item.inventory_number)}</span>{item.model ? <span>{String(item.model)}</span> : null}{item.brand ? <span>{String(item.brand)}</span> : null}{item.category ? <span className="category-name">{categoryKey ? t(categoryKey) : String(item.category)}</span> : null}<span>{t("quantity")}: {new Intl.NumberFormat(locale).format(Number(item.quantity))}</span><span>{t("locations")}: {String(item.locations || t("locationUnknown"))}</span></div></div><span className="item-index">{statusLabels[String(item.identification_status)]}</span></Link>; })}</div> : <div className="empty-state"><div className="empty-orbit">✳</div><h3>{hasFilters ? t("noMatches") : t("noItems")}</h3><p>{hasFilters ? t("adjustFilters") : t("addFirstItem")}</p></div>}
      </div>
    </section>
  </main>;
}
