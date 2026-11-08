"use client";
import {useEffect,useRef} from "react";
import {UserRound} from "lucide-react";
import Link from "next/link";
import {logoutAction} from "@/app/auth-actions";
import {useI18n} from "@/i18n/provider";
export function AccountMenu({username}:{username:string}){
  const {t}=useI18n(),root=useRef<HTMLDetailsElement>(null);
  useEffect(()=>{const close=(event:MouseEvent)=>{if(event.target instanceof Node&&!root.current?.contains(event.target)&&root.current)root.current.open=false;};document.addEventListener("mousedown",close);return()=>document.removeEventListener("mousedown",close);},[]);
  return <details className="account-menu" ref={root} onKeyDown={event=>{if(event.key==="Escape"&&root.current){root.current.open=false;root.current.querySelector("summary")?.focus();}}}><summary className="icon-button" aria-label={t("authAccount")} title={username}><UserRound size={18} aria-hidden="true"/></summary><div className="account-panel"><span>{username}</span><Link className="quiet-button" href="/account">{t("authAccountSettings")}</Link><form action={logoutAction}><button className="quiet-button" type="submit">{t("authSignOut")}</button></form></div></details>;
}
