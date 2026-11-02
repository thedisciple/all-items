"use client";
import {useActionState} from "react";
import {installationBackupAction} from "@/app/backup-actions";
import type {ActionFeedback} from "@/app/actions";
import {ActionForm} from "./action-form";
import {FormSubmitButton} from "./form-submit-button";
import {useI18n} from "@/i18n/provider";

export function InstallationBackups({backups}:{backups:{id:string;verified:boolean;createdAt:string|null;bytes:number|null}[]}){
  const {t,locale}=useI18n(),[feedback,action,pending]=useActionState(installationBackupAction,{status:"idle",message:""} as ActionFeedback);
  const latest=backups.filter(b=>b.verified).sort((a,b)=>b.createdAt!.localeCompare(a.createdAt!))[0];
  return <section className="data-panel" aria-labelledby="installation-backups-title"><h2 id="installation-backups-title">{t("installationBackups")}</h2><p>{t("installationBackupScope")}</p>
    {latest?<p>{new Intl.DateTimeFormat(locale,{dateStyle:"medium",timeStyle:"short"}).format(new Date(latest.createdAt!))} · {Math.ceil(latest.bytes!/1024/1024)} MiB</p>:<p>{t("installationBackupNone")}</p>}
    <div className="dialog-actions"><ActionForm action={action} pending={pending}><input type="hidden" name="operation" value="create"/><FormSubmitButton pendingLabel={t("installationBackupPending")}>{t("installationBackupCreate")}</FormSubmitButton></ActionForm>{latest?<ActionForm action={action} pending={pending}><input type="hidden" name="operation" value="verify"/><input type="hidden" name="backupId" value={latest.id}/><FormSubmitButton pendingLabel={t("installationBackupPending")}>{t("installationBackupVerify")}</FormSubmitButton></ActionForm>:null}</div>
    {backups.some(b=>!b.verified)?<p role="alert">{t("installationBackupFailure")}</p>:null}{!pending&&feedback.message?<p role={feedback.status==="error"?"alert":"status"}>{t(feedback.message)}</p>:null}
  </section>;
}
