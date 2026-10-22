import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { AppSidebar } from "@/app/components/app-sidebar";
import { CollectionManageForms } from "@/app/components/collection-forms";
import { formatRussianCount } from "@/app/format-count";
import { listCollections, getCollection } from "@/items/collections";
import { listItems } from "@/items/service";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ q?: string; category?: string; status?: string; sort?: string }> };
const statuses: Record<string, string> = { unknown: "Не определён", user_confirmed: "Подтверждён", source_verified: "Проверен по источнику" };

export default async function CollectionPage({ params, searchParams }: Props) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const parsedId = z.uuid().safeParse(id);
  if (!parsedId.success) notFound();
  const collection = await getCollection(parsedId.data);
  if (!collection) notFound();
  const [collections, items] = await Promise.all([
    listCollections(),
    listItems({ collectionId: id, search: query.q, category: query.category || undefined, status: query.status || undefined, sort: query.sort }),
  ]);
  return <main className="app-shell"><AppSidebar active="collections" collectionCount={collections.length}/>
    <section className="main-content"><header className="topbar"><div className="breadcrumb"><Link href="/">Все вещи</Link><span>/</span><Link href="/collections">Коллекции</Link><span>/</span>{String(collection.name)}</div></header>
      <div className="content-wrap"><div className="heading-row"><div><div className="eyebrow">КОЛЛЕКЦИЯ</div><h1>{String(collection.name)}</h1><p className="subtitle">{formatRussianCount(Number(collection.itemCount), "вещь", "вещи", "вещей")} · вещи также доступны в общем инвентаре</p></div><Link href="/" className="quiet-button link-button">Все вещи</Link></div>
        <CollectionManageForms id={id} name={String(collection.name)}/>
        <form className="filter-bar collection-filter" method="get"><label className="search-field"><span aria-hidden="true">⌕</span><input name="q" defaultValue={query.q} placeholder="Найти вещь в коллекции" maxLength={160}/></label><input name="category" defaultValue={query.category} placeholder="Категория" maxLength={80}/><select name="status" defaultValue={query.status ?? ""}><option value="">Любой статус</option><option value="unknown">Не определён</option><option value="user_confirmed">Подтверждён</option><option value="source_verified">Проверен по источнику</option></select><select name="sort" defaultValue={query.sort ?? "date"}><option value="date">Сначала новые</option><option value="name">По названию</option><option value="quantity">По количеству</option></select><button className="quiet-button">Найти</button></form>
        <div className="list-heading"><div><h2>Вещи в коллекции</h2></div><span className="list-total">{String(items.length).padStart(2, "0")}</span></div>
        {items.length ? <div className="item-list">{items.map((item) => <Link href={`/items/${item.id}`} className="item-row" key={String(item.id)}>{item.primary_media_id ? <Image className="item-photo" src={`/media/${item.id}/${item.primary_media_id}?variant=thumbnail`} alt="" width={80} height={80} unoptimized/> : <div className="item-thumb"><span>Фото</span></div>}<div className="item-info"><h3>{String(item.name)}</h3><div className="item-meta"><span className="model-tag">{String(item.inventory_number)}</span>{item.model ? <span>{String(item.model)}</span> : null}{item.category ? <span className="model-tag">{String(item.category)}</span> : null}<span>Количество: {String(item.quantity)}</span><span>Места: {String(item.locations || "не указаны")}</span></div></div><span className="item-index">{statuses[String(item.identification_status)]}</span></Link>)}</div> : <div className="empty-state"><div className="empty-orbit">✳</div><h3>{query.q ? "Ничего не найдено" : "В этой коллекции пока нет вещей"}</h3><p>{query.q ? "Измените запрос поиска." : "Откройте карточку вещи и добавьте её в эту коллекцию."}</p><Link className="quiet-button link-button" href="/">Перейти к инвентарю</Link></div>}
      </div>
    </section>
  </main>;
}
