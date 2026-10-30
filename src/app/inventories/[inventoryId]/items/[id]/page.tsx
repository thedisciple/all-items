import { routeInventory } from "@/app/inventory-routing";
import { inventoryPath } from "@/items/inventory-context";
import { notFound } from "next/navigation";
import { z } from "zod";
import { AppSidebar } from "@/app/components/app-sidebar";
import { CollectionMembership } from "@/app/components/collection-membership";
import { ItemEditForm } from "@/app/components/item-edit-form";
import { PhotoGallery } from "@/app/components/photo-gallery";
import { DestructiveConfirmation } from "@/app/components/destructive-confirmation";
import { removeItem } from "@/app/actions";
import { listCollections, listItemCollections } from "@/items/collections";
import { getItem } from "@/items/service";
import { listItemPhotos } from "@/media/service";
import { getLocale } from "@/i18n/server";
import { translate } from "@/i18n/messages";
import { AppHeader } from "@/app/components/app-header";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ id: string; inventoryId: string }>; searchParams: Promise<{ from?: string }> };

export default async function ItemPage({ params, searchParams }: Props) {
  const [{ id, inventoryId }, query] = await Promise.all([params, searchParams]);
  const context = await routeInventory(inventoryId);
  const base = inventoryPath(context);
  const parsedId = z.uuid().safeParse(id);
  if (!parsedId.success) notFound();
  const item = await getItem(context, parsedId.data);
  if (!item) notFound();
  const [locale, photos, collections, memberships] = await Promise.all([
    getLocale(),
    listItemPhotos(context, id), listCollections(context), listItemCollections(context, id),
  ]);
  const t = (key: Parameters<typeof translate>[1]) => translate(locale, key);
  const draft = {
    name: item.name, model: item.model ?? "", brand: item.brand ?? "", categories: item.categories,
    originalMarking: item.original_marking ?? "", identificationStatus: item.identification_status,
    trackingMode: item.tracking_mode, saleIntent: item.sale_intent,
    askingPrice: item.asking_price_minor == null ? "" : (item.asking_price_minor / 100).toFixed(2),
    askingCurrency: item.asking_currency ?? "RUB", description: item.description ?? "", notes: item.notes ?? "",
  };
  const fromCollection = z.uuid().safeParse(query.from ?? "");
  const returnTo = fromCollection.success ? `${base}/collections/${fromCollection.data}` : base;
  return <main className="app-shell">
    <AppSidebar active="items" locale={locale}/>
    <section className="main-content"><AppHeader/>
      <div className="content-wrap detail-wrap">
        <div className="item-hero"><h1>{item.name || t("unidentifiedItemName")}</h1><span className="item-number-badge">{item.inventory_number}</span></div>
        <section className="photo-detail-panel" aria-label={t("photo")}>
          <PhotoGallery itemId={id} photos={photos} itemName={item.name || t("unidentifiedItemName")}/>
        </section>
        <ItemEditForm itemId={id} initial={draft} initialRows={item.stock} returnTo={returnTo}/>
        <CollectionMembership itemId={id} collections={collections.map(({ id: collectionId, name }) => ({ id: collectionId, name }))} memberships={memberships}/>
        <DestructiveConfirmation action={removeItem} label={t("itemDelete")} description={t("itemDeleteWarning")} fields={{ id }}/>
      </div>
    </section>
  </main>;
}
