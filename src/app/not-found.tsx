import Link from "next/link";
import {AppBrand} from "./components/app-brand";
import {getLocale} from "@/i18n/server";
import {translate} from "@/i18n/messages";

export default async function NotFound(){
  const locale=await getLocale();
  return <main className="not-found-page"><AppBrand href="/" label="All Items"/><section aria-labelledby="not-found-title"><span className="not-found-orbit" aria-hidden="true">⌕</span><h1 id="not-found-title">{translate(locale,"notFoundTitle")}</h1><p>{translate(locale,"notFoundMessage")}</p><Link className="quiet-button" href="/">{translate(locale,"notFoundReturn")}</Link></section></main>;
}
