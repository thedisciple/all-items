import { addItem } from "./actions";
import Link from "next/link";
import { Boxes, Plus, Sparkles } from "lucide-react";
import { listItems } from "@/items/service";

export const dynamic = "force-dynamic";

function formatDate(date: string) {
  return new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short" }).format(new Date(date));
}

export default async function Home() {
  const items = await listItems();
  return (
    <main className="app-shell">
      <aside className="sidebar">
        <Link className="brand" href="/" aria-label="Все вещи — главная"><span className="brand-mark">в</span><span>все вещи<span className="brand-period">.</span></span></Link>
        <div className="side-label">МОЯ КОЛЛЕКЦИЯ</div>
        <Link className="nav-link active" href="/"><Boxes className="nav-icon" size={15} aria-hidden="true" />Все вещи<span className="nav-count">{items.length}</span></Link>
        <div className="sidebar-bottom"><span className="status-dot" />Локальное хранилище<div className="privacy-note">Данные остаются на этом устройстве</div></div>
      </aside>

      <section className="main-content">
        <header className="topbar"><div className="breadcrumb">Коллекция <span>/</span> Все вещи</div><div className="avatar">А</div></header>
        <div className="content-wrap">
          <div className="heading-row"><div><div className="eyebrow">ВАША КОЛЛЕКЦИЯ</div><h1>Все вещи</h1><p className="subtitle">Личная опись того, что у вас есть.</p></div><div className="total-badge"><span>{items.length}</span> {items.length === 1 ? "вещь" : "вещей"}</div></div>

          <section className="add-panel">
            <div className="panel-intro"><Sparkles className="sparkle" size={16} aria-hidden="true" /><div><h2>Добавить вещь</h2><p>Начните с названия — остальное можно заполнить позже.</p></div></div>
            <form action={addItem} className="add-form">
              <label className="field name-field"><span>Название</span><input name="name" placeholder="Например, плата Arduino Uno" maxLength={160} required /></label>
              <label className="field"><span>Модель или маркировка <em>необязательно</em></span><input name="model" placeholder="Например, R3" maxLength={160} /></label>
              <button className="add-button" type="submit"><Plus size={14} aria-hidden="true" /> Добавить</button>
            </form>
          </section>

          <div className="list-heading"><div><h2>Недавно добавленные</h2><span className="list-caption">Ваши вещи в одном месте</span></div><span className="list-total">{items.length.toString().padStart(2, "0")}</span></div>
          {items.length ? <div className="item-list">{items.map((item, index) => <article className="item-row" key={item.id}><div className="item-thumb"><span>{item.name.trim().charAt(0).toLocaleUpperCase("ru-RU")}</span></div><div className="item-info"><h3>{item.name}</h3><div className="item-meta">{item.model ? <span className="model-tag">{item.model}</span> : <span className="no-model">Модель не указана</span>}<span className="meta-separator">·</span><span>{formatDate(item.createdAt)}</span></div></div><span className="item-index">{String(items.length - index).padStart(2, "0")}</span></article>)}</div> : <div className="empty-state"><div className="empty-orbit"><span>✳</span></div><h3>Здесь пока пусто</h3><p>Добавьте первую вещь — и ваша личная опись начнёт собираться.</p></div>}
          <footer className="page-footer">Создано для вещей, которые хочется сохранить. <span>Все данные хранятся локально.</span></footer>
        </div>
      </section>
    </main>
  );
}
