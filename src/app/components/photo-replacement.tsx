"use client";

import { useActionState } from "react";
import { replacePhotoAction, type PhotoActionFeedback } from "@/app/actions";
import { PhotoAcquisition } from "./photo-acquisition";

const idle: PhotoActionFeedback = { status: "idle", message: "" };

export function PhotoReplacement({ itemId, photoUrl }: { itemId: string; photoUrl: string | null }) {
  const [feedback, action] = useActionState(replacePhotoAction, idle);
  const currentUrl = feedback.status === "success" && feedback.mediaId
    ? `/media/${itemId}/${feedback.mediaId}?v=${feedback.mediaId}`
    : photoUrl;
  return <form action={action} className="photo-replacement-form">
    <input type="hidden" name="id" value={itemId}/>
    <PhotoAcquisition name="photo" currentPhotoUrl={currentUrl} autoSubmit savedToken={feedback.status === "success" ? feedback.mediaId : undefined} resultToken={feedback.message} retryReady={feedback.status === "error"}/>
    {feedback.message ? <p className={`inline-status ${feedback.status === "error" ? "error-status" : "success-status"}`} role={feedback.status === "error" ? "alert" : "status"}>{feedback.message}</p> : null}
  </form>;
}
