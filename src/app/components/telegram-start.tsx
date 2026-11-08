"use client";
import {useState,type FormEvent} from "react";
import {useI18n} from "@/i18n/provider";

type Intent="login"|"invite"|"link";
type ErrorKey="authTelegramFailed"|"authTelegramInviteInvalid"|"authTelegramReauth";
export function TelegramStart({intent}:{intent:Intent}){
  const {t}=useI18n(),[pending,setPending]=useState(false),[error,setError]=useState<ErrorKey|null>(null);
  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();if(pending)return;
    setPending(true);setError(null);
    let leaving=false;
    try{
      const response=await fetch("/auth/telegram/start",{method:"POST",body:new FormData(event.currentTarget),headers:{accept:"application/json"},credentials:"same-origin",cache:"no-store"});
      const body=await response.json();
      if(!response.ok||typeof body.url!=="string"){
        setError(["authTelegramInviteInvalid","authTelegramReauth"].includes(body.error)?body.error:"authTelegramFailed");
        return;
      }
      leaving=true;location.assign(body.url);
    }catch{setError("authTelegramFailed");}finally{if(!leaving)setPending(false);}
  }
  return <form action="/auth/telegram/start" method="post" onSubmit={submit} aria-busy={pending}>
    <input type="hidden" name="intent" value={intent}/>
    {intent==="invite"?<label className="field"><span>{t("authTelegramInviteToken")}</span><input name="invite" required minLength={43} maxLength={43} autoCapitalize="none" spellCheck={false} disabled={pending}/></label>:null}
    {intent==="link"?<label className="field"><span>{t("authPasswordConfirm")}</span><input name="password" type="password" required autoComplete="current-password" disabled={pending}/></label>:null}
    {error?<p className="form-error" role="alert">{t(error)}</p>:null}
    <button className="quiet-button" type="submit" disabled={pending}>{t(intent==="link"?"authTelegramConnect":"authTelegramSignIn")}</button>
  </form>;
}
