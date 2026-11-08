import Link from "next/link";
import {cookies} from "next/headers";
import {getDatabase} from "@/db/client";
import {pageUser} from "@/auth/request";
import {telegramConfig} from "@/auth/telegram-config";
import {linkedTelegram} from "@/auth/telegram";
import {getLocale} from "@/i18n/server";
import {translate} from "@/i18n/messages";
import {LanguageSwitcher} from "@/app/components/language-switcher";
import {AppBrand} from "@/app/components/app-brand";
import {TelegramStart} from "@/app/components/telegram-start";
import {cancelTelegramAction,confirmTelegramAction,unlinkTelegramAction} from "./actions";

export const dynamic="force-dynamic";
export default async function Account({searchParams}:{searchParams:Promise<{telegram?:string}>}){
  const user=await pageUser(),locale=await getLocale(),t=(key:Parameters<typeof translate>[1])=>translate(locale,key);
  const config=telegramConfig(),db=(await getDatabase()).$client,linked=config?await linkedTelegram(db,user.id):false;
  const pending=(await cookies()).get("all-items-telegram-pending")?.value;
  const result=(await searchParams).telegram;
  const hasPassword=Boolean((await db.execute({sql:"SELECT password_hash FROM auth_users WHERE id=?",args:[user.id]})).rows[0]?.password_hash);
  return <main className="login-page"><header className="topbar"><AppBrand href="/" label="All Items"/></header><section className="login-panel account-settings"><Link href="/" className="quiet-button">{t("authBack")}</Link><h1>{t("authAccountSettings")}</h1><p>{user.username}</p>
    <section aria-label={t("language")}><h2>{t("language")}</h2><LanguageSwitcher/></section>
    {result==="failed"?<p role="alert">{t("authTelegramFailed")}</p>:result==="linked"?<p role="status">{t("authTelegramLinked")}</p>:result==="unlinked"?<p role="status">{t("authTelegramUnlinked")}</p>:null}
    {config?<section aria-label={t("authTelegramSignIn")}>
      {linked?<><p>{t("authTelegramConnected")}</p>{hasPassword?<form action={unlinkTelegramAction}><label>{t("authPasswordConfirm")}<input name="password" type="password" required autoComplete="current-password"/></label><button type="submit" className="quiet-button">{t("authTelegramDisconnect")}</button></form>:null}</>:
       pending?<><p>{t("authTelegramPending")}</p><div className="dialog-actions"><form action={cancelTelegramAction}><button type="submit" className="quiet-button">{t("authTelegramCancel")}</button></form><form action={confirmTelegramAction}><button type="submit" className="primary-button">{t("authTelegramConfirm")}</button></form></div></>:
       hasPassword?<TelegramStart intent="link"/>:null}
    </section>:null}
  </section></main>;
}
