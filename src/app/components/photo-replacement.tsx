"use client";

import { useActionState, useCallback, useEffect, useState } from "react";
import { replacePhotoAction, type PhotoActionFeedback } from "@/app/actions";
import { PhotoAcquisition } from "./photo-acquisition";

const idle: PhotoActionFeedback = { status: "idle", message: "" };

export function PhotoReplacement({ itemId, photoUrl, itemName }: { itemId: string; photoUrl: string | null; itemName: string }) {
  const [feedback, action] = useActionState(replacePhotoAction, idle);
  const [savedUrl, setSavedUrl] = useState(photoUrl);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const updatePreview = useCallback((url: string | null) => setPreviewUrl(url), []);

  useEffect(() => {
    if (feedback.status === "success" && feedback.mediaId) {
      setSavedUrl(`/media/${itemId}/${feedback.mediaId}?v=${feedback.mediaId}`);
      setPreviewUrl(null);
    } else if (feedback.status === "error") {
      setPreviewUrl(null);
    }
  }, [feedback, itemId]);

  return <form action={action} className="photo-replacement-form">
    <input type="hidden" name="id" value={itemId}/>
    <div className="item-photo-viewer">
      {previewUrl || savedUrl ? <img className="detail-photo" src={previewUrl ?? savedUrl ?? ""} alt={`Фотография: ${itemName}`} /> : <div className="compact-photo-placeholder"><span aria-hidden="true">Фото</span><p>Фотографии ещё нет</p></div>}
      {previewUrl ? <p className="photo-unsaved-note" role="status">Предварительный просмотр · не сохранено</p> : null}
    </div>
    <PhotoAcquisition name="photo" currentPhotoUrl={savedUrl} autoSubmit savedToken={feedback.status === "success" ? feedback.mediaId : undefined} resultToken={feedback.message} retryReady={feedback.status === "error"} externalPreview onPreviewChange={updatePreview}/>
    {feedback.message ? <p className={`inline-status ${feedback.status === "error" ? "error-status" : "success-status"}`} role={feedback.status === "error" ? "alert" : "status"}>{feedback.message}</p> : null}
  </form>;
}
