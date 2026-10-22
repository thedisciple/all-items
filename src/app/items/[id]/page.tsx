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

export default async function ItemPage({ params }: Props) {
  const { id } = await params;
  const parsedId = z.uuid().safeParse(id);
  if (!parsedId.success) notFound();
  const item = await getItem(parsedId.data);
  if (!item) notFound();
  const [photo, collections, memberships, allItems] = await Promise.all([
    getPrimaryPhoto(id), listCollections(), listItemCollections(id), listItems(),
  ]);
  const locations = item.stock.map((entry) => entry.location).filter((name): name is string => Boolean(name));
  const draft = {
    name: item.name, model: item.model ?? "", brand: item.brand ?? "", category: item.category ?? "",
    originalMarking: item.original_marking ?? "", identificationStatus: item.identification_status,
    trackingMode: item.tracking_mode, saleIntent: item.sale_intent,
    askingPrice: item.asking_price_minor == null ? "" : (item.asking_price_minor / 100).toFixed(2),
    askingCurrency: item.asking_currency ?? "RUB", description: item.description ?? "", notes: item.notes ?? "",
  };
  return <main className="app-shell">
    <AppSidebar active="items" itemCount={allItems.length} collectionCount={collections.length}/>
    <section className="main-content"><header className="topbar"><div className="breadcrumb"><Link href="/">Все вещи</Link><span>/</span>{item.inventory_number}</div></header>
      <div className="content-wrap detail-wrap">
        <div className="eyebrow">ИНВЕНТАРНЫЙ НОМЕР · {item.inventory_number}</div>
        <div className="item-hero"><div><h1>{item.name}</h1><p className="subtitle">{[item.brand, item.model].filter(Boolean).join(" · ") || "Личная опись"}</p></div><span className="item-number-badge">{item.inventory_number}</span></div>
        <section className="item-summary" aria-label="Краткая информация">
          <div><span>Всего</span><strong>{item.quantity}</strong></div>
          <div><span>Места хранения</span><strong>{locations.length ? locations.join(", ") : "Не указаны"}</strong></div>
          <div><span>Категория</span><strong>{item.category || "Не указана"}</strong></div>
        </section>
        <section className="photo-detail-panel" aria-label="Фотография вещи">
          {photo ? <Image className="detail-photo" src={`/media/${id}/${photo.id}`} alt={`Фотография: ${item.name}`} width={photo.width} height={photo.height} unoptimized/> : <div className="compact-photo-placeholder"><span aria-hidden="true">Фото</span><p>Фотографии ещё нет</p></div>}
          <PhotoReplacement itemId={id} photoUrl={photo ? `/media/${id}/${photo.id}` : null}/>
          {photo ? <details className="remove-photo-panel"><summary>Удалить фотографию</summary><form action={removePhoto}><input type="hidden" name="id" value={id}/><label><input required type="checkbox" name="confirm"/> Подтверждаю удаление фотографии</label><button className="delete-button" type="submit">Удалить фото</button></form></details> : null}
        </section>
        <ItemEditForm itemId={id} initial={draft}/>
        <StockEditor itemId={id} initialRows={item.stock} trackingMode={item.tracking_mode}/>
        <CollectionMembership itemId={id} collections={collections.map(({ id: collectionId, name }) => ({ id: collectionId, name }))} memberships={memberships}/>
        <details className="advanced-fields technical-details"><summary>Технические сведения</summary><dl><div><dt>Идентификатор</dt><dd>{id}</dd></div><div><dt>Добавлена</dt><dd>{item.created_at}</dd></div><div><dt>Изменена</dt><dd>{item.updated_at}</dd></div></dl></details>
        <details className="delete-panel"><summary>Удалить вещь</summary><form action={removeItem}><input type="hidden" name="id" value={id}/><p>Будут удалены карточка, записи о запасе и фотографии.</p><label><input required type="checkbox" name="confirm"/> Подтверждаю удаление этой вещи</label><button className="delete-button" type="submit">Удалить вещь без возможности отмены</button></form></details>
      </div>
    </section>
  </main>;
}
