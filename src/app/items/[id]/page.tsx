import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { AppSidebar } from "@/app/components/app-sidebar";
import { CollectionMembership } from "@/app/components/collection-membership";
import { ItemEditForm } from "@/app/components/item-edit-form";
import { PhotoReplacement } from "@/app/components/photo-replacement";
import { StockEditor } from "@/app/components/stock-editor";
import { removeItem, removePhoto } from "@/app/actions";
import { listCollections, listItemCollections } from "@/items/collections";
import { getItem, listItems } from "@/items/service";
import { getPrimaryPhoto } from "@/media/service";
import { getLocale } from "@/i18n/server";
import { translate } from "@/i18n/messages";
import { categoryEmoji, categoryKeyForStoredValue, categoryMessageKey } from "@/items/categories";
import { LanguageSwitcher } from "@/app/components/language-switcher";
import { Trash2 } from "lucide-react";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ from?: string; updated?: string }> };

export default async function ItemPage({ params, searchParams }: Props) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const parsedId = z.uuid().safeParse(id);
  if (!parsedId.success) notFound();
  const item = await getItem(parsedId.data);
  if (!item) notFound();
  const [locale, photo, collections, memberships, allItems] = await Promise.all([
    getLocale(),
    getPrimaryPhoto(id), listCollections(), listItemCollections(id), listItems(),
  ]);
  const t = (key: Parameters<typeof translate>[1]) => translate(locale, key);
  const locations = item.stock.map((entry) => entry.location).filter((name): name is string => Boolean(name));
  const draft = {
    name: item.name, model: item.model ?? "", brand: item.brand ?? "", category: item.category ?? "",
    originalMarking: item.original_marking ?? "", identificationStatus: item.identification_status,
    trackingMode: item.tracking_mode, saleIntent: item.sale_intent,
    askingPrice: item.asking_price_minor == null ? "" : (item.asking_price_minor / 100).toFixed(2),
    askingCurrency: item.asking_currency ?? "RUB", description: item.description ?? "", notes: item.notes ?? "",
  };
  const fromCollection = z.uuid().safeParse(query.from ?? "");
  const returnTo = fromCollection.success ? `/collections/${fromCollection.data}` : "/";
  return <main className="app-shell">
    <AppSidebar active="items" itemCount={allItems.length} collectionCount={collections.length} locale={locale}/>
    <section className="main-content"><header className="topbar"><div className="breadcrumb"><Link href={returnTo}>{returnTo === "/" ? t("allItems") : t("collections")}</Link><span>/</span>{item.inventory_number}</div><LanguageSwitcher/></header>
      <div className="content-wrap detail-wrap">
        {query.updated ? <p className="inline-status success-status" role="status">{t("changesSaved")}</p> : null}
        <div className="item-hero"><div><h1>{item.name}</h1><p className="subtitle">{[item.brand, item.model].filter(Boolean).join(" · ") || t("noName")}</p></div><span className="item-number-badge">{item.inventory_number}</span></div>
        <section className="item-summary" aria-label={t("itemSummary")}>
          <div><span>{t("total")}</span><strong>{new Intl.NumberFormat(locale).format(item.quantity)}</strong></div>
          <div><span>{t("locations")}</span><strong>{locations.length ? locations.join(", ") : t("locationUnknown")}</strong></div>
          <div><span>{t("category")}</span><strong>{item.category ? `${categoryKeyForStoredValue(String(item.category)) ? `${categoryEmoji[categoryKeyForStoredValue(String(item.category))!]} ` : ""}${categoryMessageKey(String(item.category)) ? t(categoryMessageKey(String(item.category))!) : item.category}` : t("categoryUnknown")}</strong></div>
        </section>
        <section className="photo-detail-panel" aria-label={t("photo")}>
          <PhotoReplacement itemId={id} photoUrl={photo ? `/media/${id}/${photo.id}?v=${photo.id}` : null} itemName={item.name}/>
          {photo ? <details className="remove-photo-panel"><summary>{t("photoDelete")}</summary><form action={removePhoto}><input type="hidden" name="id" value={id}/><label><input required type="checkbox" name="confirm"/> {t("photoDeleteConfirm")}</label><button className="delete-button" type="submit"><Trash2 size={16} aria-hidden="true"/><span>{t("photoDelete")}</span></button></form></details> : null}
        </section>
        <ItemEditForm itemId={id} initial={draft} returnTo={returnTo}/>
        <StockEditor itemId={id} initialRows={item.stock} trackingMode={item.tracking_mode}/>
        <CollectionMembership itemId={id} collections={collections.map(({ id: collectionId, name }) => ({ id: collectionId, name }))} memberships={memberships}/>
        <details className="delete-panel"><summary>{t("itemDelete")}</summary><form action={removeItem}><input type="hidden" name="id" value={id}/><p>{t("itemDeleteWarning")}</p><label><input required type="checkbox" name="confirm"/> {t("itemDeleteConfirm")}</label><button className="delete-button" type="submit"><Trash2 size={16} aria-hidden="true"/><span>{t("itemDeleteFinal")}</span></button></form></details>
      </div>
    </section>
  </main>;
}
