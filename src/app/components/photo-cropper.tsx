"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import type CropperJS from "cropperjs";
import { useI18n } from "@/i18n/provider";

const PhotoCropperEditor = dynamic(() => import("./photo-cropper-editor"), { ssr: false });
type CropData = CropperJS.Data;

export function PhotoCropper({ file, onConfirm, onCancel }: { file: File; onConfirm: (file: File, crop: CropData) => void; onCancel: () => void }) {
  const { t } = useI18n();
  const [sourceUrl, setSourceUrl] = useState("");
  useEffect(() => {
    const url = URL.createObjectURL(file);
    setSourceUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  return sourceUrl ? <PhotoCropperEditor file={file} sourceUrl={sourceUrl} onConfirm={onConfirm} onCancel={onCancel} cancelLabel={t("cancel")} sourceAlt={t("cropSourceAlt")} title={t("cropTitle")} help={t("cropHelp")} confirmLabel={t("cropConfirm")} resetLabel={t("cropReset")} zoomLabel={t("cropZoom")} aspectLabel={t("cropAspect")} aspectFree={t("cropAspectFree")} aspectOriginal={t("cropAspectOriginal")} previewLabel={t("cropPreview")} rotateLabel={t("cropRotate")} movingLabel={t("cropMoveCrop")} resizingLabel={t("cropResizeCrop")} moveLeft={t("cropMoveLeft")} moveRight={t("cropMoveRight")} moveUp={t("cropMoveUp")} moveDown={t("cropMoveDown")} shrinkWidth={t("cropShrinkWidth")} growWidth={t("cropGrowWidth")} shrinkHeight={t("cropShrinkHeight")} growHeight={t("cropGrowHeight")} errorLabel={t("cropFailed")} smallLabel={t("cropTooSmall")} busyLabel={t("cropPreparing")} /> : null;
}
