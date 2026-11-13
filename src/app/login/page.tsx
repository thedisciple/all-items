import {redirect} from "next/navigation";
import {currentUser} from "@/auth/request";
import {getLocale} from "@/i18n/server";
import {translate} from "@/i18n/messages";
import {LanguageSwitcher} from "@/app/components/language-switcher";
import {LoginForm} from "@/app/components/login-form";
import {telegramConfig} from "@/auth/telegram-config";
import {TelegramStart} from "@/app/components/telegram-start";
import {AppBrand} from "@/app/components/app-brand";
export const dynamic="force-dynamic";
export default async function Login({searchParams}:{searchParams:Promise<{telegram?:string}>}){if(await currentUser())redirect("/");const locale=await getLocale(),enabled=Boolean(telegramConfig()),error=(await searchParams).telegram;return <main className="login-page"><header className="topbar"><AppBrand href="/" label="All Items"/><LanguageSwitcher/></header><section className="login-panel"><h1>{translate(locale,"authSignIn")}</h1><LoginForm/>{error==="failed"?<p className="form-error" role="alert">{translate(locale,"authTelegramFailed")}</p>:null}{enabled?<div className="telegram-login"><TelegramStart intent="login"/><details><summary>{translate(locale,"authTelegramInvite")}</summary><TelegramStart intent="invite"/></details></div>:null}</section></main>;}
