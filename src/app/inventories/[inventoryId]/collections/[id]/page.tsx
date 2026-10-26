import { routeInventory } from "@/app/inventory-routing";
import { inventoryPath } from "@/items/inventory-context";
import { PhotoViewer } from "@/app/components/photo-viewer";
import { notFound } from "next/navigation";
import { z } from "zod";
import { AppSidebar } from "@/app/components/app-sidebar";
import { CollectionManageForms } from "@/app/components/collection-forms";
import { CollectionAddItems, CollectionCoverManager, RemoveCollectionItem } from "@/app/components/collection-tools";
import { listCollectionCoverOptions, getCollection } from "@/items/collections";
import { listCategoryValues, listItems } from "@/items/service";
import { getLocale } from "@/i18n/server";
import { formatItemCount, translate } from "@/i18n/messages";
import { categories, categoryEmoji, categoryKeyForStoredValue, categoryMessageKey } from "@/items/categories";
import { AppHeader } from "@/app/components/app-header";
import { ItemFilters } from "@/app/components/item-filters";
import { CollectionCoverVisual } from "@/app/components/collection-cover-visual";
import { InventoryItemRow } from "@/app/components/inventory-item-row";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ id: string; inventoryId: string }>; searchParams: Promise<{ q?: string; category?: string; status?: string; sort?: string; updated?: string }> };

export default async function CollectionPage({ params, searchParams }: Props) {
  const [{ id, inventoryId }, query] = await Promise.all([params, searchParams]);
  const context = await routeInventory(inventoryId);
  const base = inventoryPath(context);
  const parsedId = z.uuid().safeParse(id);
  if (!parsedId.success) notFound();
  const collection = await getCollection(context, parsedId.data);
  if (!collection) notFound();
  const [locale, items, members, inventory, coverOptions, storedCategories] = await Promise.all([
    getLocale(),
    listItems(context, { collectionId: id, search: query.q, category: query.category || undefined, status: query.status || undefined, sort: query.sort }),
    listItems(context, { collectionId: id }),
    listItems(context),
    listCollectionCoverOptions(context, id),
    listCategoryValues(context, id),
  ]);
  const t = (key: Parameters<typeof translate>[1], values?: Record<string, string | number>) => translate(locale, key, values);
  const statuses: Record<string, string> = { unknown: t("itemStatusUnknown"), user_confirmed: t("itemStatusConfirmed"), source_verified: t("itemStatusVerified") };
  const hasActiveFilter = Boolean(query.q || query.category || query.status);
  const selectableItems = inventory.map((item) => ({ id: String(item.id), name: String(item.name), model: item.model == null ? null : String(item.model), category: item.categories.join(" "), mediaId: item.primary_media_id == null ? null : String(item.primary_media_id) }));
  const categoryOptions: { value: string; label: string }[] = [...categories.map((category) => ({ value: category, label: categoryEmoji[category] + " " + t(categoryMessageKey(category)!) }))];
  for (const value of storedCategories) if (!categoryKeyForStoredValue(value)) categoryOptions.push({ value, label: value });
  return <main className="app-shell"><AppSidebar active="collections" locale={locale}/>
    <section className="main-content"><AppHeader/>
      <div className="content-wrap">
        <div className="heading-row collection-detail-heading"><div><h1>{collection.icon && !(collection.coverType === "emoji" && collection.coverIcon === collection.icon) ? <span aria-hidden="true">{collection.icon} </span> : null}{String(collection.name)}</h1><p className="subtitle">{formatItemCount(locale, Number(collection.itemCount))}</p></div>
          <div className="collection-detail-actions"><CollectionManageForms id={id} name={String(collection.name)} icon={collection.icon == null ? null : String(collection.icon)}/>{Number(collection.itemCount) > 0 ? <CollectionAddItems collectionId={id} items={selectableItems} existingIds={members.map((item) => String(item.id))}/> : null}</div>
        </div>
        {collection.coverType === "upload" && collection.coverUploadId || collection.coverType === "item_photo" && collection.coverMediaId ? <PhotoViewer cover src={collection.coverType === "upload" ? `${base}/media/collections/${id}/${collection.coverUploadId}?variant=image` : `${base}/media/${collection.coverItemId}/${collection.coverMediaId}?variant=image`} alt={collection.name} action={<CollectionCoverManager collectionId={id} options={coverOptions}/>}/> : <div className="collection-cover-empty"><CollectionCoverVisual base={base} collection={collection} variant="detail"/><CollectionCoverManager add={collection.coverType === "default"} collectionId={id} options={coverOptions}/></div>}
        {Number(collection.itemCount) > 0 ? <ItemFilters categories={categoryOptions} statuses={Object.entries(statuses).map(([value,label]) => ({ value, label }))} searchPlaceholder={t("collectionItemsSearch")}/> : null}
        {items.length ? <>
          <div className="list-heading"><h2>{t("collectionItems")}</h2>{hasActiveFilter ? <span className="list-total">{t("resultCount", { count: items.length })}</span> : null}</div>
          <div className="item-list">{items.map(item => <div className="collection-item-row" key={String(item.id)}><InventoryItemRow item={item} base={base} locale={locale} query={query} collectionId={id}/><RemoveCollectionItem collectionId={id} itemId={String(item.id)}/></div>)}</div>
        </> : Number(collection.itemCount) === 0 ? <div className="empty-state collection-detail-empty"><div className="empty-orbit" aria-hidden="true">{collection.icon ?? "📦"}</div><h3>{t("collectionNoItems")}</h3><CollectionAddItems collectionId={id} items={selectableItems} existingIds={[]}/></div> : <div className="empty-state"><div className="empty-orbit" aria-hidden="true">⌕</div><h3>{t("noMatches")}</h3><p>{t("adjustFilters")}</p></div>}
      </div>
    </section>
  </main>;
}
