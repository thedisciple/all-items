import Link from "next/link";
import { notFound } from "next/navigation";
import { getItem } from "@/items/service";
import { editItem, removeItem, updateStock } from "@/app/actions";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ id: string }> };
const val = (item: Record<string, unknown>, key: string) => item[key] == null ? "" : String(item[key]);
const statuses = [["unknown","Не определён"],["user_confirmed","Подтверждён мной"],["source_verified","Проверен по источнику"]];

export default async function ItemPage({ params }: Props) {
  const { id } = await params;
  const item = await getItem(id);
  if (!item) notFound();
  const data = item as Record<string, unknown>;
  const stockText = (item.stock as Array<{ quantity: number; location: string | null }>).map((entry) => `${entry.location ?? ""} | ${entry.quantity}`).join("\n");
  return <main className="app-shell"><aside className="sidebar"><Link className="brand" href="/"><span className="brand-mark">в</span><span>все вещи<span className="brand-period">.</span></span></Link><div className="side-label">МОЯ КОЛЛЕКЦИЯ</div><Link className="nav-link active" href="/">← К списку вещей</Link><div className="sidebar-bottom"><span className="status-dot"/>Локальное хранилище<div className="privacy-note">Данные остаются на этом устройстве</div></div></aside>
    <section className="main-content"><header className="topbar"><div className="breadcrumb"><Link href="/">Коллекция</Link><span>/</span>{val(data,"inventory_number")}</div></header><div className="content-wrap detail-wrap"><div className="eyebrow">КАРТОЧКА ВЕЩИ · {val(data,"inventory_number")}</div><h1>{val(data,"name")}</h1><p className="subtitle">UUID: {id}</p>
      <form action={editItem} className="detail-panel"><input type="hidden" name="id" value={id}/><h2>Сведения</h2><div className="detail-grid">
        <label className="field"><span>Название *</span><input required maxLength={160} name="name" defaultValue={val(data,"name")}/></label>
        <label className="field"><span>Модель</span><input maxLength={160} name="model" defaultValue={val(data,"model")}/></label>
        <label className="field"><span>Бренд</span><input maxLength={120} name="brand" defaultValue={val(data,"brand")}/></label>
        <label className="field"><span>Категория</span><input maxLength={80} name="category" defaultValue={val(data,"category")}/></label>
        <label className="field"><span>Оригинальная маркировка</span><input maxLength={160} name="originalMarking" defaultValue={val(data,"original_marking")}/></label>
        <label className="field"><span>Статус определения</span><select name="identificationStatus" defaultValue={val(data,"identification_status")}>{statuses.map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
        <label className="field"><span>Режим учёта</span><select name="trackingMode" defaultValue={val(data,"tracking_mode")}><option value="unique">Уникальная вещь</option><option value="bulk">Штучный запас</option><option value="consumable">Расходный материал</option></select></label>
        <label className="field"><span>План продажи · только для вас</span><select name="saleIntent" defaultValue={val(data,"sale_intent")}><option value="not_for_sale">Не планирую продавать</option><option value="considering">Рассматриваю продажу</option><option value="willing_to_sell">Готов продать лично</option></select></label>
        <label className="field"><span>Цена · сумма в выбранной валюте</span><input type="number" min="0" step="0.01" name="askingPrice" defaultValue={data.asking_price_minor == null ? "" : (Number(data.asking_price_minor)/100).toFixed(2)}/></label>
        <label className="field"><span>Валюта</span><select name="askingCurrency" defaultValue={val(data,"asking_currency") || "RUB"}><option value="RUB">RUB</option><option value="EUR">EUR</option><option value="USD">USD</option><option value="HUF">HUF</option></select></label>
        <label className="field full-field"><span>Описание</span><textarea name="description" maxLength={4000} defaultValue={val(data,"description")}/></label>
        <label className="field full-field"><span>Заметки</span><textarea name="notes" maxLength={2000} defaultValue={val(data,"notes")}/></label>
      </div><button className="add-button" type="submit">Сохранить изменения</button></form>
      <form action={updateStock} className="detail-panel"><input type="hidden" name="id" value={id}/><h2>Количество и места хранения</h2><p className="list-caption">Одна запись на строку: место хранения | количество. Оставьте место пустым для общего запаса.</p><label className="field"><span>Сейчас всего: {val(data,"quantity")}</span><textarea className="stock-textarea" name="stock" defaultValue={stockText} placeholder={'Шкаф A | 3\nЯщик 2 | 5'} /></label><button className="quiet-button" type="submit">Сохранить запас</button></form>
      <details className="delete-panel"><summary>Удалить вещь</summary><form action={removeItem}><input type="hidden" name="id" value={id}/><label><input required type="checkbox" name="confirm"/> Подтверждаю удаление этой вещи и её записей о запасе</label><button className="delete-button" type="submit">Удалить без возможности отмены</button></form></details>
      <p className="list-caption">Добавлена: {val(data,"created_at")} · Изменена: {val(data,"updated_at")}</p>
    </div></section></main>;
}
