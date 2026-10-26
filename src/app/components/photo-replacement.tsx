"use client";

import { ActionForm } from "./action-form";

import { useActionState, useCallback, useEffect, useState } from "react";
import { replacePhotoAction, type PhotoActionFeedback } from "@/app/actions";
import { PhotoAcquisition } from "./photo-acquisition";
import { PhotoViewer } from "./photo-viewer";
import { useInventory, InventoryField } from "./inventory-provider";
import { useI18n } from "@/i18n/provider";

const idle: PhotoActionFeedback = { status: "idle", message: "" };

export function PhotoReplacement({ itemId, photoUrl, itemName }: { itemId: string; photoUrl: string | null; itemName: string }) {
  const { t } = useI18n();
  const { base } = useInventory();
  const [feedback, action, actionPending] = useActionState(replacePhotoAction, idle);
  const [savedUrl, setSavedUrl] = useState(photoUrl);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const updatePreview = useCallback((url: string | null) => setPreviewUrl(url), []);

  useEffect(() => {
    if (feedback.status === "success" && feedback.mediaId) {
      setSavedUrl(`${base}/media/${itemId}/${feedback.mediaId}?v=${feedback.mediaId}`);
      setPreviewUrl(null);
    }
  }, [feedback, itemId, base]);

  useEffect(() => {
    setSavedUrl(photoUrl);
    setPreviewUrl(null);
  }, [photoUrl]);

  return <ActionForm action={action} pending={actionPending} className="photo-replacement-form">
    <InventoryField/><input type="hidden" name="id" value={itemId}/>
    <div className="item-photo-viewer">
      {previewUrl || savedUrl ? <PhotoViewer src={previewUrl ?? savedUrl ?? ""} alt={`${t("photo")}: ${itemName}`}/> : <div className="compact-photo-placeholder"><span aria-hidden="true">{t("photo")}</span><p>{t("photoMissing")}</p></div>}
      {previewUrl ? <p className="photo-unsaved-note" role="status">{t("previewUnsaved")}</p> : null}
    </div>
    <PhotoAcquisition name="photo" currentPhotoUrl={savedUrl} autoSubmit savedToken={feedback.status === "success" ? feedback.mediaId : undefined} resultToken={feedback.message ? t(feedback.message, feedback.values) : ""} retryReady={feedback.status === "error"} externalPreview onPreviewChange={updatePreview}/>
    {feedback.status === "error" && feedback.message ? <p className="inline-status error-status" role="alert">{feedback.message ? t(feedback.message, feedback.values) : ""}</p> : feedback.status === "success" && feedback.message ? <p className="visually-hidden" role="status">{feedback.message ? t(feedback.message, feedback.values) : ""}</p> : null}
  </ActionForm>;
}
