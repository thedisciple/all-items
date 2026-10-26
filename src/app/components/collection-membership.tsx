"use client";

import { ActionForm } from "./action-form";

import { useActionState } from "react";
import Link from "next/link";
import { addCollectionMembershipAction, removeCollectionMembershipAction, type ActionFeedback } from "@/app/actions";
import { FormSubmitButton } from "./form-submit-button";
import { useInventory } from "./inventory-provider";
import { useI18n } from "@/i18n/provider";
import { Plus, Trash2 } from "lucide-react";

const emptyFeedback: ActionFeedback = { status: "idle", message: "" };
type Collection = { id: string; name: string };

export function CollectionMembership({ itemId, collections, memberships }: { itemId: string; collections: Collection[]; memberships: Collection[] }) {
  const { t } = useI18n();
  const { base } = useInventory();
  const [addFeedback, addAction, addActionPending] = useActionState(addCollectionMembershipAction, emptyFeedback);
  const [removeFeedback, removeAction, removeActionPending] = useActionState(removeCollectionMembershipAction, emptyFeedback);
  const available = collections.filter((collection) => !memberships.some((membership) => membership.id === collection.id));
  return <section className="detail-panel collection-membership-panel">
    <div className="section-heading"><div><h2>{t("collections")}</h2></div></div>
    {memberships.length ? <ul className="membership-list">{memberships.map((collection) => <li key={collection.id}><Link href={`${base}/collections/${collection.id}`}>{collection.name}</Link><ActionForm action={removeAction} pending={removeActionPending}><input type="hidden" name="itemId" value={itemId}/><input type="hidden" name="collectionId" value={collection.id}/><FormSubmitButton className="icon-button row-remove-button membership-remove" label={t("remove")} pendingLabel={t("removing")}><Trash2 size={16} aria-hidden="true"/></FormSubmitButton></ActionForm></li>)}</ul> : null}
    {available.length ? <ActionForm action={addAction} pending={addActionPending} className="membership-add-form"><input type="hidden" name="itemId" value={itemId}/><label className="field"><span>{t("collectionAddItem")}</span><select name="collectionId" required defaultValue=""><option value="" disabled>{t("collectionChoose")}</option>{available.map((collection) => <option value={collection.id} key={collection.id}>{collection.name}</option>)}</select></label><FormSubmitButton className="add-button" pendingLabel={t("adding")}><Plus size={15} aria-hidden="true"/>{t("add")}</FormSubmitButton></ActionForm> : !collections.length ? <Link href={`${base}/collections`} className="quiet-button link-button">{t("collectionCreateOpen")}</Link> : null}
    {[addFeedback, removeFeedback].filter((feedback) => feedback.message).map((feedback, index) => <p key={index} className={feedback.status === "error" ? "inline-status error-status" : "visually-hidden"} role={feedback.status === "error" ? "alert" : "status"}>{feedback.message ? t(feedback.message, feedback.values) : ""}</p>)}
  </section>;
}
