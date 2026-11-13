"use client";
import Link from "next/link";
import {usePathname,useRouter,useSearchParams} from "next/navigation";
import {useI18n} from "@/i18n/provider";

export function ItemPagination({page,pages,total,pageSize}:{page:number;pages:number;total:number;pageSize:number}){
  const {t,locale}=useI18n(),pathname=usePathname(),router=useRouter(),params=useSearchParams();
  function destination(nextPage:number,size=pageSize){const next=new URLSearchParams(params.toString());next.delete("added");next.delete("updated");if(nextPage===1)next.delete("page");else next.set("page",String(nextPage));next.set("pageSize",String(size));return pathname+"?"+next;}
  const from=total?(page-1)*pageSize+1:0,to=Math.min(page*pageSize,total),format=(value:number)=>new Intl.NumberFormat(locale).format(value);
  return <nav className="item-pagination" aria-label={t("pageNavigation")}>
    <span className="page-summary">{t("pageSummary",{from:format(from),to:format(to),count:format(total)})}</span>
    <div className="page-controls">{page>1?<Link className="quiet-button" href={destination(page-1)}>{t("pagePrevious")}</Link>:<span className="quiet-button" role="link" aria-disabled="true">{t("pagePrevious")}</span>}<span aria-live="polite">{t("pageOf",{page:format(page),pages:format(pages)})}</span>{page<pages?<Link className="quiet-button" href={destination(page+1)}>{t("pageNext")}</Link>:<span className="quiet-button" role="link" aria-disabled="true">{t("pageNext")}</span>}</div>
    <label className="page-size"><span>{t("pageSize")}</span><select aria-label={t("pageSize")} value={pageSize} onChange={event=>router.push(destination(1,Number(event.target.value)))}>{[25,50,100].map(size=><option value={size} key={size}>{format(size)}</option>)}</select></label>
  </nav>;
}
