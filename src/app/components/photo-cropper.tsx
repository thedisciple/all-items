"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import type CropperJS from "cropperjs";
import { useI18n } from "@/i18n/provider";

const PhotoCropperEditor = dynamic(() => import("./photo-cropper-editor"), { ssr: false });
type CropData = CropperJS.Data;

export function PhotoCropper({ file, onConfirm, onCancel, onUseOriginal, initialCrop }: { initialCrop?: CropData | null; file: File; onConfirm: (file: File, crop: CropData) => void; onCancel: () => void; onUseOriginal: () => void }) {
  const { t } = useI18n();
  const [sourceUrl, setSourceUrl] = useState("");
  const [sourceFailed, setSourceFailed] = useState(false);
  useEffect(() => {
    setSourceUrl("");
    setSourceFailed(false);
    try {
      const url = URL.createObjectURL(file);
      setSourceUrl(url);
      return () => URL.revokeObjectURL(url);
    } catch {
      setSourceFailed(true);
    }
  }, [file]);
  if (sourceFailed) return <div className="photo-source-overlay crop-overlay" role="presentation"><section className="photo-source-dialog crop-dialog" role="dialog" aria-modal="true" aria-label={t("cropUnavailable")}><div className="dialog-heading"><h3>{t("cropUnavailable")}</h3><button type="button" className="icon-button" aria-label={t("cancel")} onClick={onCancel}>×</button></div><div className="dialog-actions"><button type="button" className="quiet-button" onClick={onUseOriginal}>{t("cropUseOriginal")}</button><button type="button" className="text-button" onClick={onCancel}>{t("cancel")}</button></div></section></div>;
  return sourceUrl ? <PhotoCropperEditor initialCrop={initialCrop} file={file} sourceUrl={sourceUrl} onConfirm={onConfirm} onCancel={onCancel} onUseOriginal={onUseOriginal} cancelLabel={t("cancel")} sourceAlt={t("cropSourceAlt")} title={t("cropTitle")} confirmLabel={t("cropConfirm")} resetLabel={t("cropReset")} originalLabel={t("cropUseOriginal")} zoomLabel={t("cropZoom")} aspectLabel={t("cropAspect")} aspectFree={t("cropAspectFree")} aspectOriginal={t("cropAspectOriginal")} rotateLabel={t("cropRotate")} rotateCounterclockwiseLabel={t("cropRotateCounterclockwise")} moveLeft={t("cropMoveLeft")} moveRight={t("cropMoveRight")} moveUp={t("cropMoveUp")} moveDown={t("cropMoveDown")} moveCropLabel={t("cropMoveCrop")} resizeCropLabel={t("cropResizeCrop")} shrinkWidth={t("cropShrinkWidth")} growWidth={t("cropGrowWidth")} shrinkHeight={t("cropShrinkHeight")} growHeight={t("cropGrowHeight")} errorLabel={t("cropFailed")} smallLabel={t("cropTooSmall")} busyLabel={t("cropPreparing")} keyboardLabel={t("cropKeyboardControls")} unavailableLabel={t("cropUnavailable")} /> : null;
}
