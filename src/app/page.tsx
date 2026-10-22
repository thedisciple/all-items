import Link from "next/link";
import Image from "next/image";
import { Search } from "lucide-react";
import { listItems } from "@/items/service";
import { listCollections } from "@/items/collections";
import { AppSidebar } from "@/app/components/app-sidebar";
import { AddItemForm } from "@/app/components/add-item-form";
import { formatRussianCount } from "@/app/format-count";

export const dynamic = "force-dynamic";
type Props = { searchParams: Promise<{ q?: string; category?: string; status?: string; sort?: string }> };
const statusLabels: Record<string, string> = { unknown: "Не определён", user_confirmed: "Подтверждён", source_verified: "Проверен по источнику" };

export default async function Home({ searchParams }: Props) {
  const params = await searchParams;
  const [items, collections] = await Promise.all([
    listItems({ search: params.q, category: params.category || undefined, status: params.status || undefined, sort: params.sort }),
    listCollections(),
  ]);
  return <main className="app-shell">
    <AppSidebar active="items" itemCount={items.length} collectionCount={collections.length}/>
    <section className="main-content"><header className="topbar"><div className="breadcrumb">Коллекция <span>/</span> Все вещи</div></header>
      <div className="content-wrap"><div className="heading-row"><div><div className="eyebrow">ВАША КОЛЛЕКЦИЯ</div><h1>Все вещи</h1><p className="subtitle">Личная опись того, что у вас есть.</p></div><div className="total-badge">{formatRussianCount(items.length, "вещь", "вещи", "вещей")}</div></div>
        <section className="add-panel photo-first-panel"><div className="panel-intro"><div><h2>Добавить вещь</h2><p>Сфотографируйте предмет или заполните название. Можно начать только с фотографии.</p></div></div>
          <AddItemForm/>
        </section>
        <form className="filter-bar" method="get"><label className="search-field"><Search size={15}/><input name="q" defaultValue={params.q} placeholder="Название, модель, бренд, маркировка или заметки" maxLength={160}/></label><input name="category" defaultValue={params.category} placeholder="Категория"/><select name="status" defaultValue={params.status ?? ""}><option value="">Любой статус</option>{Object.entries(statusLabels).map(([key,value])=><option value={key} key={key}>{value}</option>)}</select><select name="sort" defaultValue={params.sort ?? "date"}><option value="date">Сначала новые</option><option value="name">По названию</option><option value="quantity">По количеству</option></select><button className="quiet-button">Найти</button></form>
        <div className="list-heading"><div><h2>Инвентарь</h2><span className="list-caption">Поиск охватывает названия, модели, маркировку, бренд и заметки</span></div><span className="list-total">{String(items.length).padStart(2,"0")}</span></div>
        {items.length ? <div className="item-list">{items.map((item) => <Link href={`/items/${item.id}`} className="item-row" key={String(item.id)}>{item.primary_media_id ? <Image className="item-photo" src={`/media/${item.id}/${item.primary_media_id}?variant=thumbnail`} alt="" width={80} height={80} unoptimized/> : <div className="item-thumb" aria-label="Фотография не добавлена"><span>Фото</span></div>}<div className="item-info"><h3>{String(item.name)}</h3><div className="item-meta"><span className="model-tag">{String(item.inventory_number)}</span>{item.model ? <span>{String(item.model)}</span> : null}{item.brand ? <span>{String(item.brand)}</span> : null}{item.category ? <span className="model-tag">{String(item.category)}</span> : null}<span>Количество: {String(item.quantity)}</span><span>Места: {String(item.locations || "не указаны")}</span></div></div><span className="item-index">{statusLabels[String(item.identification_status)]}</span></Link>)}</div> : <div className="empty-state"><div className="empty-orbit">✳</div><h3>{params.q || params.category || params.status ? "Ничего не найдено" : "Здесь пока пусто"}</h3><p>{params.q || params.category || params.status ? "Измените параметры поиска или фильтры." : "Добавьте первую вещь — и ваша личная опись начнёт собираться."}</p></div>}
        <footer className="page-footer">Создано для вещей, которые хочется сохранить. <span>Все данные хранятся локально.</span></footer>
      </div>
    </section>
  </main>;
}
