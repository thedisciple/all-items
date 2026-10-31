"use client";

import type CropperJS from "cropperjs";
import { ActionForm } from "./action-form";

import { useActionState, useCallback, useEffect, useState, useRef } from "react";
import {useRouter} from "next/navigation";
import { replacePhotoAction, type PhotoActionFeedback } from "@/app/actions";
import { PhotoAcquisition,type PhotoDraft } from "./photo-acquisition";
import { PhotoViewer, type PhotoNavigation } from "./photo-viewer";
import { useInventory, InventoryField } from "./inventory-provider";
import { useI18n } from "@/i18n/provider";

const idle: PhotoActionFeedback = { status: "idle", message: "" };

export function PhotoReplacement({ itemId, photoUrl, itemName, mediaId, crop, hideEmptyViewer = false, onDirtyChange, announceSuccess = true, navigation }: { navigation?: PhotoNavigation; announceSuccess?: boolean; itemId: string; photoUrl: string | null; itemName: string; mediaId?: string; crop?: CropperJS.Data | null; hideEmptyViewer?: boolean; onDirtyChange?: (value: boolean) => void }) {
  const { t } = useI18n();
  const { base } = useInventory();
  const router=useRouter();
  const writeId=useRef<string|null>(null);
  const [hasSelection,setHasSelection]=useState(false);
  const [feedback, action, actionPending] = useActionState(async(previous:PhotoActionFeedback,data:FormData):Promise<PhotoActionFeedback>=>{
    // An unacknowledged attempt retains its identity even if its draft is corrected.
    writeId.current??=crypto.randomUUID();data.set("photoWriteId",writeId.current);
    try{return await replacePhotoAction(previous,data);}catch{return{status:"error",message:"photoSaveGeneric"};}
  }, idle);
  const selection=useCallback((photo:PhotoDraft|null)=>{
    setHasSelection(Boolean(photo?.selected||photo?.pending));
    if(!photo){writeId.current=null;if(feedback.message==="photoWriteConflict")router.refresh();}
  },[feedback.message,router]);
  const [savedUrl, setSavedUrl] = useState(photoUrl);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  useEffect(() => () => onDirtyChange?.(false), [onDirtyChange]);
  const updatePreview = useCallback((url: string | null) => setPreviewUrl(url), []);

  useEffect(() => {
    if (feedback.status === "success" && feedback.mediaId) {
      writeId.current=null;setHasSelection(false);
      setSavedUrl(hideEmptyViewer ? null : `${base}/media/${itemId}/${feedback.mediaId}?v=${feedback.mediaId}`);
      setPreviewUrl(null);
    }
  }, [feedback, itemId, base, hideEmptyViewer]);

  useEffect(() => {
    setSavedUrl(photoUrl);
    setPreviewUrl(null);
  }, [photoUrl]);

  return <ActionForm action={action} pending={actionPending} className="photo-replacement-form">
    <InventoryField/><input type="hidden" name="id" value={itemId}/><input type="hidden" name="photoOperation" value={photoUrl ? "replace" : "add"}/>{mediaId ? <input type="hidden" name="mediaId" value={mediaId}/> : null}
    {!hideEmptyViewer || previewUrl || savedUrl ? <div className="item-photo-viewer">
      {previewUrl || savedUrl ? <PhotoViewer navigation={navigation} src={previewUrl ?? savedUrl ?? ""} alt={`${t("photo")}: ${itemName}`}/> : <div className="compact-photo-placeholder"><span aria-hidden="true">{t("photo")}</span><p>{t("photoMissing")}</p></div>}
      {previewUrl ? <p className="photo-unsaved-note" role="status">{t("previewUnsaved")}</p> : null}
    </div> : null}
    <PhotoAcquisition key={mediaId ?? "new"} name="photo" initialCrop={crop} onDraftChange={onDirtyChange} onRecoveryChange={selection} currentPhotoUrl={savedUrl} autoSubmit savedToken={feedback.status === "success" ? feedback.mediaId : undefined} resultToken={feedback.message ? t(feedback.message, feedback.values) : ""} retryReady={feedback.status === "error"} externalPreview onPreviewChange={updatePreview}/>
    {!actionPending&&hasSelection&&feedback.status === "error" && feedback.message ? <p className="inline-status error-status" role="alert">{feedback.message ? t(feedback.message, feedback.values) : ""}</p> : announceSuccess && feedback.status === "success" && feedback.message ? <p className="visually-hidden" role="status">{feedback.message ? t(feedback.message, feedback.values) : ""}</p> : null}
  </ActionForm>;
}
