import Link from "next/link";
import { PrivateImage } from "./private-image";
import { categoryEmoji, categoryKeyForStoredValue, categoryMessageKey } from "@/items/categories";
import { translate, type Locale } from "@/i18n/messages";

type Item = Record<string, unknown> & { categories: string[] };
type Query = { q?: string; category?: string; status?: string; sort?: string };

export function InventoryItemRow({ item, base, locale, query, collectionId, highlighted }: { item: Item; base: string; locale: Locale; query: Query; collectionId?: string; highlighted?: boolean }) {
  const t=(key:Parameters<typeof translate>[1])=>translate(locale,key);
  const path=collectionId?`${base}/collections/${collectionId}`:base;
  const itemPath=`${base}/items/${item.id}${collectionId?`?from=${collectionId}`:""}`;
  const status=String(item.identification_status);
  const statusKey=status==="user_confirmed"?"itemStatusConfirmed":status==="source_verified"?"itemStatusVerified":null;
  return <div className={`item-row item-grid-row${highlighted?" item-row-highlight":""}`}>
    <Link href={itemPath} className="item-row-link" aria-label={String(item.name)}><span className="visually-hidden">{String(item.name)} {String(item.inventory_number)} {String(item.quantity)}</span></Link>
    {item.primary_media_id?<PrivateImage variant="thumbnail" className="item-photo" src={`${base}/media/${item.id}/${item.primary_media_id}?variant=thumbnail`} alt="" width={80} height={80}/>:<div className="item-thumb" aria-hidden="true"><span>{t("photo")}</span></div>}
    <div className="item-identity"><h3>{String(item.name)}</h3><div className="item-identity-meta"><span className="inventory-number">{String(item.inventory_number)}</span>{item.model?<span>{String(item.model)}</span>:null}{item.brand?<span>{String(item.brand)}</span>:null}</div></div>
    <div className="item-categories">{item.categories.map(value=>{
      const key=categoryKeyForStoredValue(value), label=key?translate(locale,categoryMessageKey(key)!):value;
      const params=new URLSearchParams();for(const [name,entry] of Object.entries(query))if(entry&&["q","status","sort"].includes(name))params.set(name,entry);
      params.set("category",value);
      return <Link key={value} href={`${path}?${params}`} scroll={false} className="category-chip item-category-filter">{key?<span aria-hidden="true">{categoryEmoji[key]}</span>:null}{label}</Link>;
    })}</div>
    <div className="item-stock"><span>{t("quantity")}: {new Intl.NumberFormat(locale).format(Number(item.quantity))}</span>{item.locations?<span>{String(item.locations)}</span>:null}</div>
    {statusKey?<span className="item-index">{t(statusKey)}</span>:null}
  </div>;
}
