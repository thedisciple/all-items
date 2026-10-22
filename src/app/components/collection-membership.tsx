"use client";

import { useActionState } from "react";
import Link from "next/link";
import { addCollectionMembershipAction, removeCollectionMembershipAction, type ActionFeedback } from "@/app/actions";
import { FormSubmitButton } from "./form-submit-button";

const emptyFeedback: ActionFeedback = { status: "idle", message: "" };
type Collection = { id: string; name: string };

export function CollectionMembership({ itemId, collections, memberships }: { itemId: string; collections: Collection[]; memberships: Collection[] }) {
  const [addFeedback, addAction] = useActionState(addCollectionMembershipAction, emptyFeedback);
  const [removeFeedback, removeAction] = useActionState(removeCollectionMembershipAction, emptyFeedback);
  const available = collections.filter((collection) => !memberships.some((membership) => membership.id === collection.id));
  return <section className="detail-panel collection-membership-panel">
    <div className="section-heading"><div><h2>Коллекции</h2><p className="field-help">Группируйте вещь отдельно от категории и места хранения. Она может быть в нескольких коллекциях.</p></div></div>
    {memberships.length ? <ul className="membership-list">{memberships.map((collection) => <li key={collection.id}><Link href={`/collections/${collection.id}`}>{collection.name}</Link><form action={removeAction}><input type="hidden" name="itemId" value={itemId}/><input type="hidden" name="collectionId" value={collection.id}/><button type="submit" className="text-button">Убрать</button></form></li>)}</ul> : <p className="field-help">Пока не добавлено ни в одну коллекцию.</p>}
    {available.length ? <form action={addAction} className="membership-add-form"><input type="hidden" name="itemId" value={itemId}/><label className="field"><span>Добавить в коллекцию</span><select name="collectionId" required defaultValue=""><option value="" disabled>Выберите коллекцию</option>{available.map((collection) => <option value={collection.id} key={collection.id}>{collection.name}</option>)}</select></label><FormSubmitButton>Добавить</FormSubmitButton></form> : collections.length ? <p className="field-help">Вещь уже состоит во всех коллекциях.</p> : <p className="field-help">Сначала создайте коллекцию.</p>}
    {[addFeedback, removeFeedback].filter((feedback) => feedback.message).map((feedback, index) => <p key={index} className={`inline-status ${feedback.status === "error" ? "error-status" : "success-status"}`} role={feedback.status === "error" ? "alert" : "status"}>{feedback.message}</p>)}
  </section>;
}
