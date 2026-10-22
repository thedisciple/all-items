"use client";

import { useActionState, useEffect, useState } from "react";
import { createCollectionAction, deleteCollectionAction, renameCollectionAction, type ActionFeedback } from "@/app/actions";
import { FormSubmitButton } from "./form-submit-button";
import { useI18n } from "@/i18n/provider";

const idle: ActionFeedback = { status: "idle", message: "" };

export function CreateCollectionForm() {
  const { t } = useI18n();
  const [feedback, action] = useActionState(createCollectionAction, idle);
  const [name, setName] = useState("");
  useEffect(() => { if (feedback.status === "success") setName(""); }, [feedback]);
  return <form action={action} className="collection-create-form">
    <label className="field"><span>{t("collectionName")}</span><input name="name" value={name} maxLength={120} required placeholder={t("collectionNamePlaceholder")} onChange={(event) => setName(event.target.value)}/></label>
    <FormSubmitButton className="add-button" pendingLabel={t("collectionCreating")}>{t("collectionCreate")}</FormSubmitButton>
    {feedback.message ? <p className={`inline-status ${feedback.status === "error" ? "error-status" : "success-status"}`} role={feedback.status === "error" ? "alert" : "status"}>{feedback.message}</p> : null}
  </form>;
}

export function CollectionManageForms({ id, name }: { id: string; name: string }) {
  const { t } = useI18n();
  const [renameFeedback, renameAction] = useActionState(renameCollectionAction, idle);
  const [deleteFeedback, deleteAction] = useActionState(deleteCollectionAction, idle);
  const [draftName, setDraftName] = useState(name);
  return <div className="collection-manage-forms">
    <form action={renameAction} className="collection-rename-form">
      <input type="hidden" name="id" value={id}/>
      <label className="field"><span>{t("collectionRenameTitle")}</span><input name="name" value={draftName} maxLength={120} required onChange={(event) => setDraftName(event.target.value)}/></label>
      <FormSubmitButton pendingLabel={t("savingChanges")}>{t("collectionRename")}</FormSubmitButton>
      {renameFeedback.message ? <p className={`inline-status ${renameFeedback.status === "error" ? "error-status" : "success-status"}`} role={renameFeedback.status === "error" ? "alert" : "status"}>{renameFeedback.message}</p> : null}
    </form>
    <details className="delete-panel collection-delete-panel"><summary>{t("collectionDelete")}</summary><p>{t("collectionDeleteWarning")}</p>
      <form action={deleteAction}><input type="hidden" name="id" value={id}/><label><input type="checkbox" name="confirm" required/> {t("collectionDeleteConfirm")}: «{name}»</label><FormSubmitButton className="delete-button" pendingLabel={t("deleting")}>{t("collectionDelete")}</FormSubmitButton></form>
      {deleteFeedback.message ? <p className={`inline-status ${deleteFeedback.status === "error" ? "error-status" : "success-status"}`} role={deleteFeedback.status === "error" ? "alert" : "status"}>{deleteFeedback.message}</p> : null}
    </details>
  </div>;
}
