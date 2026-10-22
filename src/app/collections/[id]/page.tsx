import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { AppSidebar } from "@/app/components/app-sidebar";
import { CollectionManageForms } from "@/app/components/collection-forms";
import { CollectionAddItems, CollectionCoverManager, RemoveCollectionItem } from "@/app/components/collection-tools";
import { listCollectionCoverOptions, listCollections, getCollection } from "@/items/collections";
import { listCategoryValues, listItems } from "@/items/service";
import { getLocale } from "@/i18n/server";
import { formatItemCount, translate } from "@/i18n/messages";
import { categories, categoryEmoji, categoryKeyForStoredValue, categoryMessageKey } from "@/items/categories";
import { LanguageSwitcher } from "@/app/components/language-switcher";
import { ItemFilters } from "@/app/components/item-filters";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ q?: string; category?: string; status?: string; sort?: string; updated?: string }> };

export default async function CollectionPage({ params, searchParams }: Props) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const parsedId = z.uuid().safeParse(id);
  if (!parsedId.success) notFound();
  const collection = await getCollection(parsedId.data);
  if (!collection) notFound();
  const [locale, collections, items, members, inventory, coverOptions, storedCategories] = await Promise.all([
    getLocale(),
    listCollections(),
    listItems({ collectionId: id, search: query.q, category: query.category || undefined, status: query.status || undefined, sort: query.sort }),
    listItems({ collectionId: id }),
    listItems(),
    listCollectionCoverOptions(id),
    listCategoryValues(id),
  ]);
  const t = (key: Parameters<typeof translate>[1], values?: Record<string, string | number>) => translate(locale, key, values);
  const statuses: Record<string, string> = { unknown: t("itemStatusUnknown"), user_confirmed: t("itemStatusConfirmed"), source_verified: t("itemStatusVerified") };
  const hasActiveFilter = Boolean(query.q || query.category || query.status);
  const selectableItems = inventory.map((item) => ({ id: String(item.id), name: String(item.name), model: item.model == null ? null : String(item.model), category: item.category == null ? null : String(item.category), mediaId: item.primary_media_id == null ? null : String(item.primary_media_id) }));
  const categoryOptions: { value: string; label: string }[] = [...categories.map((category) => ({ value: category, label: categoryEmoji[category] + " " + t(categoryMessageKey(category)!) }))];
  for (const value of storedCategories) if (!categoryKeyForStoredValue(value)) categoryOptions.push({ value, label: value });
  return <main className="app-shell"><AppSidebar active="collections" collectionCount={collections.length} locale={locale}/>
    <section className="main-content"><header className="topbar"><div className="breadcrumb"><Link href="/collections">{t("collections")}</Link><span>/</span>{String(collection.name)}</div><LanguageSwitcher/></header>
      <div className="content-wrap">
        <div className="heading-row collection-detail-heading"><div><h1>{collection.icon ? <span aria-hidden="true">{collection.icon} </span> : null}{String(collection.name)}</h1><p className="subtitle">{formatItemCount(locale, Number(collection.itemCount))}</p></div>
          <div className="collection-detail-actions"><CollectionCoverManager collectionId={id} options={coverOptions}/>{Number(collection.itemCount) > 0 ? <CollectionAddItems collectionId={id} items={selectableItems} existingIds={members.map((item) => String(item.id))}/> : null}</div>
        </div>
        {collection.coverType === "item_photo" && collection.coverItemId && collection.coverMediaId ? <Image className="collection-detail-cover" src={`/media/${collection.coverItemId}/${collection.coverMediaId}?variant=image`} alt="" width={1200} height={480} unoptimized/> : collection.coverType === "upload" && collection.coverUploadId ? <Image className="collection-detail-cover" src={`/media/collections/${id}/${collection.coverUploadId}?variant=image`} alt="" width={1200} height={480} unoptimized/> : null}
        <CollectionManageForms id={id} name={String(collection.name)} icon={collection.icon == null ? null : String(collection.icon)}/>
        {Number(collection.itemCount) > 0 ? <ItemFilters categories={categoryOptions} statuses={Object.entries(statuses).map(([value,label]) => ({ value, label }))} searchPlaceholder={t("collectionItemsSearch")}/> : null}
        {items.length ? <>
          <div className="list-heading"><h2>{t("collectionItems")}</h2>{hasActiveFilter ? <span className="list-total">{t("resultCount", { count: items.length })}</span> : null}</div>
          <div className="item-list">{items.map((item) => { const categoryKey = item.category ? categoryMessageKey(String(item.category)) : null; const stableCategory = item.category ? categoryKeyForStoredValue(String(item.category)) : null; return <div className="collection-item-row" key={String(item.id)}><Link href={`/items/${item.id}?from=${id}`} className="item-row">{item.primary_media_id ? <Image className="item-photo" src={`/media/${item.id}/${item.primary_media_id}?variant=thumbnail`} alt="" width={80} height={80} unoptimized/> : <div className="item-thumb"><span>{t("photoMissing")}</span></div>}<div className="item-info"><h3>{String(item.name)}</h3><div className="item-meta"><span className="inventory-number">{String(item.inventory_number)}</span>{item.model ? <span>{String(item.model)}</span> : null}{item.category ? <span className="category-name">{stableCategory ? `${categoryEmoji[stableCategory]} ` : ""}{categoryKey ? t(categoryKey) : String(item.category)}</span> : null}<span>{t("quantity")}: {new Intl.NumberFormat(locale).format(Number(item.quantity))}</span></div></div><span className="item-index">{statuses[String(item.identification_status)]}</span></Link><RemoveCollectionItem collectionId={id} itemId={String(item.id)}/></div>; })}</div>
        </> : Number(collection.itemCount) === 0 ? <div className="empty-state collection-detail-empty"><div className="empty-orbit" aria-hidden="true">{collection.icon ?? "📦"}</div><h3>{t("collectionNoItems")}</h3><CollectionAddItems collectionId={id} items={selectableItems} existingIds={[]}/></div> : <div className="empty-state"><div className="empty-orbit" aria-hidden="true">⌕</div><h3>{t("noMatches")}</h3><p>{t("adjustFilters")}</p></div>}
      </div>
    </section>
  </main>;
}
