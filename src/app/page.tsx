import Link from "next/link";
import { PrivateImage } from "@/app/components/private-image";
import { listCollections } from "@/items/collections";
import { AppSidebar } from "@/app/components/app-sidebar";
import { AddItemForm } from "@/app/components/add-item-form";
import { categories, categoryMessageKey } from "@/items/categories";
import { countItems, listCategoryValues, listItems } from "@/items/service";
import { getLocale } from "@/i18n/server";
import { formatItemCount, translate } from "@/i18n/messages";
import { LanguageSwitcher } from "@/app/components/language-switcher";
import { categoryEmoji, categoryKeyForStoredValue } from "@/items/categories";
import { ItemFilters } from "@/app/components/item-filters";
import { CategoryTags } from "@/app/components/category-tag";

export const dynamic = "force-dynamic";
type Props = { searchParams: Promise<{ q?: string; category?: string; status?: string; sort?: string; added?: string; updated?: string }> };
export default async function Home({ searchParams }: Props) {
  const params = await searchParams;
  const [locale, items, collections, totalCount, storedCategories] = await Promise.all([
    getLocale(),
    listItems({ search: params.q, category: params.category || undefined, status: params.status || undefined, sort: params.sort }),
    listCollections(),
    countItems(),
    listCategoryValues(),
  ]);
  const t = (key: Parameters<typeof translate>[1], values?: Record<string, string | number>) => translate(locale, key, values);
  const hasFilters = Boolean(params.q || params.category || params.status);
  const statusLabels: Record<string, string> = { unknown: t("itemStatusUnknown"), user_confirmed: t("itemStatusConfirmed"), source_verified: t("itemStatusVerified") };
  const categoryOptions: { value: string; label: string }[] = [...categories.map((key) => ({ value: key, label: categoryEmoji[key] + " " + t(categoryMessageKey(key)!) }))];
  for (const value of storedCategories) if (!categoryKeyForStoredValue(value)) categoryOptions.push({ value, label: value });
  return <main className="app-shell">
    <AppSidebar active="items" itemCount={totalCount} collectionCount={collections.length} locale={locale}/>
    <section className="main-content">
      <header className="topbar"><span>{t("inventory")}</span><LanguageSwitcher/></header>
      <div className="content-wrap"><div className="heading-row"><h1>{t("allItems")}</h1><span className="total-count">{formatItemCount(locale, totalCount)}</span></div>
        <AddItemForm/>
        <ItemFilters categories={categoryOptions} statuses={Object.entries(statusLabels).map(([value,label]) => ({ value, label }))} searchPlaceholder={t("searchItems")}/>
        <div className="list-heading"><h2>{t("inventory")}</h2><span className="list-total">{hasFilters ? t("resultCount", { count: items.length }) : formatItemCount(locale, totalCount)}</span></div>
        {items.length ? <div className="item-list">{items.map((item) => { return <Link href={`/items/${item.id}`} className={`item-row ${params.added === String(item.id) ? "item-row-highlight" : ""}`} key={String(item.id)}>{item.primary_media_id ? <PrivateImage variant="thumbnail" className="item-photo" src={`/media/${item.id}/${item.primary_media_id}?variant=thumbnail`} alt="" width={80} height={80}/> : <div className="item-thumb" aria-hidden="true"><span>{t("photo")}</span></div>}<div className="item-info"><h3>{String(item.name)}</h3><div className="item-meta"><span className="inventory-number">{String(item.inventory_number)}</span>{item.model ? <span>{String(item.model)}</span> : null}{item.brand ? <span>{String(item.brand)}</span> : null}<CategoryTags values={item.categories} locale={locale}/><span>{t("quantity")}: {new Intl.NumberFormat(locale).format(Number(item.quantity))}</span><span>{t("locations")}: {String(item.locations || t("locationUnknown"))}</span></div></div><span className="item-index">{statusLabels[String(item.identification_status)]}</span></Link>; })}</div> : <div className="empty-state"><div className="empty-orbit">✳</div><h3>{hasFilters ? t("noMatches") : t("noItems")}</h3><p>{hasFilters ? t("adjustFilters") : t("addFirstItem")}</p></div>}
      </div>
    </section>
  </main>;
}
