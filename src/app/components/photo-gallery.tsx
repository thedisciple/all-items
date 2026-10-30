"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Star } from "lucide-react";
import type { ItemPhotoDTO } from "@/media/service";
import { deleteGalleryPhoto, galleryPhotoAction, type ActionFeedback } from "@/app/actions";
import { useInventory } from "./inventory-provider";
import { useI18n } from "@/i18n/provider";
import { PrivateImage } from "./private-image";
import { PhotoReplacement } from "./photo-replacement";
import { DestructiveConfirmation } from "./destructive-confirmation";

export function PhotoGallery({ itemId, itemName, photos }: { itemId: string; itemName: string; photos: ItemPhotoDTO[] }) {
  const { t } = useI18n();
  const { base, inventory } = useInventory();
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedPosition, setSelectedPosition] = useState(0);
  const selected = photos.find(photo => photo.id === selectedId) ?? (selectedId ? photos[Math.min(selectedPosition, photos.length - 1)] : photos.find(photo => photo.isPrimary)) ?? photos[0];
  const index = photos.findIndex(photo => photo.id === selected?.id);
  useEffect(() => { if (selectedId && photos.some(photo => photo.id === selectedId)) setSelectedPosition(index); }, [photos, selectedId, index]);
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [feedback, setFeedback] = useState<ActionFeedback>({ status: "idle", message: "" });
  const locked = pending || editing || adding;

  function mutate(operation: "primary" | "reorder", direction?: number) {
    if (!selected || locked) return;
    const data = new FormData();
    data.set("inventoryId", inventory.workspaceId); data.set("id", itemId); data.set("mediaId", selected.id); data.set("operation", operation);
    if (operation === "reorder") {
      const order = photos.map(photo => photo.id);
      const other = index + (direction ?? 0);
      if (other < 0 || other >= order.length) return;
      [order[index], order[other]] = [order[other]!, order[index]!];
      data.set("order", JSON.stringify(order));
    }
    startTransition(async () => {
      const result = await galleryPhotoAction({ status: "idle", message: "" }, data);
      setFeedback(result);
      if (result.status === "success") router.refresh();
    });
  }

  return <div className="photo-gallery" aria-label={t("gallery")} aria-busy={pending}>
    <PhotoReplacement key={selected?.id ?? "empty"} itemId={itemId} mediaId={selected?.id} crop={selected?.crop} photoUrl={selected ? `${base}/media/${itemId}/${selected.id}?v=${selected.id}` : null} itemName={itemName} onDirtyChange={setEditing}/>
    {photos.length > 0 ? <>
      <div className="gallery-strip" role="group" aria-label={t("gallery")}>
        {photos.map((photo, position) => <button type="button" className="gallery-thumbnail" key={photo.id} disabled={locked} aria-pressed={selected?.id === photo.id} aria-label={`${t("galleryPhoto", { number: position + 1 })}${photo.isPrimary ? ` — ${t("galleryPrimary")}` : ""}`} onClick={() => { setSelectedId(photo.id); setSelectedPosition(position); }}>
          <PrivateImage variant="thumbnail" src={`${base}/media/${itemId}/${photo.id}?variant=thumbnail`} alt="" width={64} height={64}/>
          {photo.isPrimary ? <Star className="gallery-primary-mark" size={14} aria-hidden="true"/> : null}
        </button>)}
      </div>
      <div className="gallery-actions">
        <button type="button" className="quiet-button" disabled={locked || selected?.isPrimary} onClick={() => mutate("primary")}><Star size={16} aria-hidden="true"/>{t(selected?.isPrimary ? "galleryPrimary" : "galleryMakePrimary")}</button>
        {photos.length > 1 ? <>
          <button type="button" className="icon-button" title={t("galleryEarlier")} aria-label={t("galleryEarlier")} disabled={locked || index === 0} onClick={() => mutate("reorder", -1)}><ArrowLeft size={17} aria-hidden="true"/></button>
          <button type="button" className="icon-button" title={t("galleryLater")} aria-label={t("galleryLater")} disabled={locked || index === photos.length - 1} onClick={() => mutate("reorder", 1)}><ArrowRight size={17} aria-hidden="true"/></button>
        </> : null}
        {!locked && selected ? <DestructiveConfirmation key={selected.id} action={deleteGalleryPhoto} label={t("photoDelete")} description={t("galleryDeleteWarning")} fields={{ id: itemId, mediaId: selected.id }}/> : null}
      </div>
      <div className="gallery-add"><PhotoReplacement itemId={itemId} photoUrl={null} itemName={itemName} hideEmptyViewer onDirtyChange={setAdding}/></div>
    </> : null}
    {pending ? <p role="status">{t("savingChanges")}</p> : null}
    {feedback.status === "error" && feedback.message ? <p className="form-error" role="alert">{t(feedback.message, feedback.values)}</p> : null}
  </div>;
}
