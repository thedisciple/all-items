import Image from "next/image";
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

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ id: string }> };
const val = (item: Record<string, unknown>, key: string) => item[key] == null ? "" : String(item[key]);

export default async function ItemPage({ params }: Props) {
  const { id } = await params;
  const parsedId = z.uuid().safeParse(id);
  if (!parsedId.success) notFound();
  const item = await getItem(parsedId.data);
  if (!item) notFound();
  const [photo, collections, memberships, allItems] = await Promise.all([
    getPrimaryPhoto(id), listCollections(), listItemCollections(id), listItems(),
  ]);
  const data = item as Record<string, unknown>;
  const locations = item.stock.map((entry) => entry.location).filter((name): name is string => Boolean(name));
  const draft = {
    name: val(data, "name"), model: val(data, "model"), brand: val(data, "brand"), category: val(data, "category"),
    originalMarking: val(data, "original_marking"), identificationStatus: val(data, "identification_status") || "unknown",
    trackingMode: val(data, "tracking_mode") || "unique", saleIntent: val(data, "sale_intent") || "not_for_sale",
    askingPrice: data.asking_price_minor == null ? "" : (Number(data.asking_price_minor) / 100).toFixed(2),
    askingCurrency: val(data, "asking_currency") || "RUB", description: val(data, "description"), notes: val(data, "notes"),
  };
  return <main className="app-shell">
    <AppSidebar active="items" itemCount={allItems.length} collectionCount={collections.length}/>
    <section className="main-content"><header className="topbar"><div className="breadcrumb"><Link href="/">Все вещи</Link><span>/</span>{val(data, "inventory_number")}</div></header>
      <div className="content-wrap detail-wrap">
        <div className="eyebrow">ИНВЕНТАРНЫЙ НОМЕР · {val(data, "inventory_number")}</div>
        <div className="item-hero"><div><h1>{val(data, "name")}</h1><p className="subtitle">{[val(data, "brand"), val(data, "model")].filter(Boolean).join(" · ") || "Личная опись"}</p></div><span className="item-number-badge">{val(data, "inventory_number")}</span></div>
        <section className="item-summary" aria-label="Краткая информация">
          <div><span>Всего</span><strong>{val(data, "quantity")}</strong></div>
          <div><span>Места хранения</span><strong>{locations.length ? locations.join(", ") : "Не указаны"}</strong></div>
          <div><span>Категория</span><strong>{val(data, "category") || "Не указана"}</strong></div>
        </section>
        <section className="photo-detail-panel" aria-label="Фотография вещи">
          {photo ? <Image className="detail-photo" src={`/media/${id}/${photo.id}`} alt={`Фотография: ${val(data, "name")}`} width={photo.width} height={photo.height} unoptimized/> : <div className="compact-photo-placeholder"><span aria-hidden="true">Фото</span><p>Фотографии ещё нет</p></div>}
          <PhotoReplacement itemId={id} photoUrl={photo ? `/media/${id}/${photo.id}` : null}/>
          {photo ? <details className="remove-photo-panel"><summary>Удалить фотографию</summary><form action={removePhoto}><input type="hidden" name="id" value={id}/><label><input required type="checkbox" name="confirm"/> Подтверждаю удаление фотографии</label><button className="delete-button" type="submit">Удалить фото</button></form></details> : null}
        </section>
        <ItemEditForm itemId={id} initial={draft}/>
        <StockEditor itemId={id} initialRows={item.stock} trackingMode={val(data, "tracking_mode")}/>
        <CollectionMembership itemId={id} collections={collections.map(({ id: collectionId, name }) => ({ id: collectionId, name }))} memberships={memberships}/>
        <details className="advanced-fields technical-details"><summary>Технические сведения</summary><dl><div><dt>Идентификатор</dt><dd>{id}</dd></div><div><dt>Добавлена</dt><dd>{val(data, "created_at")}</dd></div><div><dt>Изменена</dt><dd>{val(data, "updated_at")}</dd></div></dl></details>
        <details className="delete-panel"><summary>Удалить вещь</summary><form action={removeItem}><input type="hidden" name="id" value={id}/><p>Будут удалены карточка, записи о запасе и фотографии.</p><label><input required type="checkbox" name="confirm"/> Подтверждаю удаление этой вещи</label><button className="delete-button" type="submit">Удалить вещь без возможности отмены</button></form></details>
      </div>
    </section>
  </main>;
}
