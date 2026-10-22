import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, LibraryBig } from "lucide-react";
import { AppSidebar } from "@/app/components/app-sidebar";
import { CreateCollectionForm } from "@/app/components/collection-forms";
import { formatRussianCount } from "@/app/format-count";
import { listCollections } from "@/items/collections";

export const dynamic = "force-dynamic";

export default async function CollectionsPage() {
  const collections = await listCollections();
  return <main className="app-shell">
    <AppSidebar active="collections" collectionCount={collections.length}/>
    <section className="main-content"><header className="topbar"><div className="breadcrumb"><Link href="/">Все вещи</Link><span>/</span>Коллекции</div></header>
      <div className="content-wrap"><div className="heading-row"><div><div className="eyebrow">ОРГАНИЗАЦИЯ</div><h1>Коллекции</h1><p className="subtitle">Группируйте вещи по проектам и задачам. Одна вещь может быть в нескольких коллекциях.</p></div><span className="total-badge">{formatRussianCount(collections.length, "коллекция", "коллекции", "коллекций")}</span></div>
        <section className="add-panel collection-create-panel"><div className="panel-intro"><div><h2>Новая коллекция</h2><p>Коллекции не меняют категории и места хранения вещей.</p></div></div><CreateCollectionForm/></section>
        <div className="list-heading"><div><h2>Ваши коллекции</h2><span className="list-caption">Вещи не копируются и остаются в общем инвентаре</span></div></div>
        {collections.length ? <div className="collection-grid">{collections.map((collection) => <Link href={`/collections/${collection.id}`} className="collection-card" key={collection.id}>
          {collection.previewMediaId && collection.previewItemId ? <Image className="collection-card-image" src={`/media/${collection.previewItemId}/${collection.previewMediaId}?variant=thumbnail`} alt="" width={320} height={200} unoptimized/> : <div className="collection-card-placeholder"><LibraryBig size={25} aria-hidden="true"/></div>}
          <div className="collection-card-content"><div><h3>{collection.name}</h3><p>{formatRussianCount(Number(collection.itemCount), "вещь", "вещи", "вещей")}</p></div><ArrowUpRight size={17} aria-hidden="true"/></div>
        </Link>)}</div> : <div className="empty-state collection-empty"><div className="empty-orbit"><LibraryBig size={18} aria-hidden="true"/></div><h3>Коллекций пока нет</h3><p>Создайте первую — например, для проекта, мастерской или отдельной темы.</p></div>}
      </div>
    </section>
  </main>;
}
