"use client";

import { useActionState, useEffect, useState } from "react";
import { createCollectionAction, deleteCollectionAction, renameCollectionAction, type ActionFeedback } from "@/app/actions";
import { FormSubmitButton } from "./form-submit-button";

const idle: ActionFeedback = { status: "idle", message: "" };

export function CreateCollectionForm() {
  const [feedback, action] = useActionState(createCollectionAction, idle);
  const [name, setName] = useState("");
  useEffect(() => { if (feedback.status === "success") setName(""); }, [feedback]);
  return <form action={action} className="collection-create-form">
    <label className="field"><span>Название коллекции</span><input name="name" value={name} maxLength={120} required placeholder="Например, Робототехника" onChange={(event) => setName(event.target.value)}/></label>
    <FormSubmitButton className="add-button">Создать коллекцию</FormSubmitButton>
    {feedback.message ? <p className={`inline-status ${feedback.status === "error" ? "error-status" : "success-status"}`} role={feedback.status === "error" ? "alert" : "status"}>{feedback.message}</p> : null}
  </form>;
}

export function CollectionManageForms({ id, name }: { id: string; name: string }) {
  const [renameFeedback, renameAction] = useActionState(renameCollectionAction, idle);
  const [deleteFeedback, deleteAction] = useActionState(deleteCollectionAction, idle);
  const [draftName, setDraftName] = useState(name);
  return <div className="collection-manage-forms">
    <form action={renameAction} className="collection-rename-form">
      <input type="hidden" name="id" value={id}/>
      <label className="field"><span>Переименовать коллекцию</span><input name="name" value={draftName} maxLength={120} required onChange={(event) => setDraftName(event.target.value)}/></label>
      <FormSubmitButton>Сохранить название</FormSubmitButton>
      {renameFeedback.message ? <p className={`inline-status ${renameFeedback.status === "error" ? "error-status" : "success-status"}`} role={renameFeedback.status === "error" ? "alert" : "status"}>{renameFeedback.message}</p> : null}
    </form>
    <details className="delete-panel collection-delete-panel"><summary>Удалить коллекцию</summary><p>Вещи и фотографии останутся в инвентаре. Будут удалены только связи с этой коллекцией.</p>
      <form action={deleteAction}><input type="hidden" name="id" value={id}/><label><input type="checkbox" name="confirm" required/> Подтверждаю удаление коллекции «{name}»</label><FormSubmitButton className="delete-button" pendingLabel="Удаляем…">Удалить коллекцию</FormSubmitButton></form>
      {deleteFeedback.message ? <p className={`inline-status ${deleteFeedback.status === "error" ? "error-status" : "success-status"}`} role={deleteFeedback.status === "error" ? "alert" : "status"}>{deleteFeedback.message}</p> : null}
    </details>
  </div>;
}
