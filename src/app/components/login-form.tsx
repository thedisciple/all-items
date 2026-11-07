"use client";
import {startTransition,useActionState,useRef} from "react";
import {loginAction,type LoginFeedback} from "@/app/auth-actions";
import {useI18n} from "@/i18n/provider";
export function LoginForm(){
  const {t}=useI18n(),[feedback,action,pending]=useActionState(loginAction,{code:""} as LoginFeedback),password=useRef<HTMLInputElement>(null);
  return <form className="login-form" aria-busy={pending} onSubmit={event=>{event.preventDefault();if(pending)return;const data=new FormData(event.currentTarget);startTransition(()=>action(data));if(password.current)password.current.value="";}}>
    <label className="field"><span>{t("authUsername")}</span><input name="username" autoComplete="username" autoCapitalize="none" spellCheck={false} required maxLength={64} disabled={pending}/></label>
    <label className="field"><span>{t("authPassword")}</span><input ref={password} name="password" type="password" autoComplete="current-password" required maxLength={256} disabled={pending}/></label>
    {feedback.code?<p className="form-error" role="alert">{t(feedback.code)}</p>:null}
    <button className="add-button" type="submit" disabled={pending}>{t(pending?"authSigningIn":"authSignIn")}</button><p className="muted">{t("authInviteOnly")}</p>
  </form>;
}
