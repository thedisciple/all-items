import Link from "next/link";
import {AppBrand} from "@/app/components/app-brand";
import {LanguageSwitcher} from "@/app/components/language-switcher";
import {getLocale} from "@/i18n/server";
import {translate} from "@/i18n/messages";

export const dynamic="force-dynamic";
export default async function TelegramContinue({searchParams}:{searchParams:Promise<{mode?:string}>}){
  const locale=await getLocale(),link=(await searchParams).mode==="link"?"/account?telegram=pending":"/";
  return <main className="login-page"><header className="topbar"><AppBrand href={link} label="All Items"/><LanguageSwitcher/></header><section className="login-panel"><h1>{translate(locale,"authTelegramVerified")}</h1><Link href={link} className="add-button">{translate(locale,"authTelegramContinue")}</Link></section></main>;
}
