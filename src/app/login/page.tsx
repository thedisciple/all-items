import {redirect} from "next/navigation";
import {currentUser} from "@/auth/request";
import {getLocale} from "@/i18n/server";
import {translate} from "@/i18n/messages";
import {LanguageSwitcher} from "@/app/components/language-switcher";
import {LoginForm} from "@/app/components/login-form";
export const dynamic="force-dynamic";
export default async function Login(){if(await currentUser())redirect("/");const locale=await getLocale();return <main className="login-page"><header className="topbar"><span className="brand">All Items</span><LanguageSwitcher/></header><section className="login-panel"><h1>{translate(locale,"authSignIn")}</h1><LoginForm/></section></main>;}
