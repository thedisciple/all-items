"use client";

import { PrivateImage } from "./private-image";

import { useEffect, useRef, useState } from "react";
import { useSubmissionPending } from "./action-form";
import type { MessageKey } from "@/i18n/messages";
import type CropperJS from "cropperjs";
import { ImagePlus, Pencil, RefreshCw, X } from "lucide-react";
import { PhotoCropper } from "./photo-cropper";
import { useI18n } from "@/i18n/provider";

const maxBytes = 10 * 1024 * 1024;
const acceptedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
type CropData = CropperJS.Data;

type Props = {
  name?: string;
  currentPhotoUrl?: string | null;
  autoSubmit?: boolean;
  savedToken?: string;
  resultToken?: string;
  retryReady?: boolean;
  externalPreview?: boolean;
  onPreviewChange?: (url: string | null) => void;
  onDraftChange?: (dirty: boolean) => void;
  resetToken?: number;
};

function cameraErrorKey(error: unknown) {
  if (error instanceof DOMException) {
    if (error.name === "NotAllowedError" || error.name === "SecurityError") return "cameraDenied";
    if (error.name === "NotFoundError" || error.name === "OverconstrainedError") return "cameraMissing";
    if (error.name === "NotReadableError" || error.name === "AbortError") return "cameraBusy";
  }
  return "cameraUnavailable";
}

export function PhotoAcquisition({ name = "photo", currentPhotoUrl = null, autoSubmit = false, savedToken, resultToken, retryReady = false, externalPreview = false, onPreviewChange, onDraftChange, resetToken }: Props) {
  const { locale, t } = useI18n();
  const inputRef = useRef<HTMLInputElement>(null);
  const sourceInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const cameraRequestRef = useRef(0);
  const submittingRef = useRef(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [cropData, setCropData] = useState<CropData | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [sourceOpen, setSourceOpen] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraMessage, setCameraMessage] = useState<MessageKey|"">("");
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [selectionError, setSelectionError] = useState<MessageKey|"">("");
  const pending = useSubmissionPending();

  useEffect(() => {
    if (!previewUrl) return;
    return () => URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  useEffect(() => {
    submittingRef.current = false;
    if (!savedToken) return;
    setSelectedFile(null);
    setSourceFile(null);
    setCropData(null);
    setPreviewUrl(null);
    onPreviewChange?.(null);
    if (inputRef.current) inputRef.current.value = "";
    if (sourceInputRef.current) sourceInputRef.current.value = "";
    onDraftChange?.(false);
  }, [savedToken, resultToken, onPreviewChange]);

  useEffect(() => { if (resetToken) clearSelection(); }, [resetToken]);

  useEffect(() => {
    if (!stream || !videoRef.current) return;
    videoRef.current.srcObject = stream;
    void videoRef.current.play().catch(() => setCameraMessage("photoPreviewFailed"));
  }, [stream]);

  useEffect(() => {
    if (!sourceOpen) return;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") closeSources(); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [sourceOpen]);

  useEffect(() => {
    if (!sourceOpen) return;
    dialogRef.current?.querySelector<HTMLElement>("button:not([disabled])")?.focus();
  }, [sourceOpen, stream]);

  useEffect(() => () => { cameraRequestRef.current += 1; streamRef.current?.getTracks().forEach((track) => track.stop()); }, []);

  function stopCamera() {
    cameraRequestRef.current += 1;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setStream(null);
  }

  function closeSources() {
    stopCamera();
    setSourceOpen(false);
    triggerRef.current?.focus();
  }

  function setInputFile(ref: React.RefObject<HTMLInputElement | null>, file: File) {
    const transfer = new DataTransfer();
    transfer.items.add(file);
    if (ref.current) ref.current.files = transfer.files;
  }

  function selectFile(file: File) {
    if (file.size > maxBytes) {
      setSelectionError("photoFileTooLarge");
      if (selectedFile) setInputFile(inputRef, selectedFile);
      else if (inputRef.current) inputRef.current.value = "";
      return;
    }
    if (file.type && !acceptedTypes.has(file.type)) {
      setSelectionError("photoTypeInvalid");
      if (selectedFile) setInputFile(inputRef, selectedFile);
      else if (inputRef.current) inputRef.current.value = "";
      return;
    }
    setSelectionError("");
    onDraftChange?.(true);
    closeSources();
    setSelectedFile(null);
    setSourceFile(file);
    setCropData(null);
    setPreviewUrl(null);
    onPreviewChange?.(null);
    setCropFile(file);
  }

  function acceptSelection(file: File, data: CropData | null) {
    setCropFile(null);
    triggerRef.current?.focus();
    setInputFile(inputRef, file);
    if (sourceFile) setInputFile(sourceInputRef, sourceFile);
    setSelectedFile(file);
    setCropData(data);
    onDraftChange?.(true);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    onPreviewChange?.(url);
    if (autoSubmit && !submittingRef.current) {
      submittingRef.current = true;
      queueMicrotask(() => inputRef.current?.form?.requestSubmit());
    }
  }

  function confirmCrop(file: File, data: CropData) {
    acceptSelection(file, data);
  }

  function useOriginalPhoto() {
    const original = sourceFile ?? cropFile;
    if (!original) { cancelCrop(); return; }
    acceptSelection(original, null);
  }

  async function editCurrentPhoto() {
    if (!currentPhotoUrl) return;
    setSelectionError("");
    try {
      const response = await fetch(`${currentPhotoUrl}&variant=source`, { cache: "no-store" });
      if (!response.ok) throw new Error("Photo unavailable");
      const blob = await response.blob();
      const file = new File([blob], "saved-photo.webp", { type: blob.type || "image/webp", lastModified: Date.now() });
      setSourceFile(file);
      onDraftChange?.(true);
      setSelectedFile(null);
      setPreviewUrl(null);
      onPreviewChange?.(null);
      setCropFile(file);
    } catch {
      setSelectionError("photoSelectionFailed");
    }
  }

  async function startCamera(mode = facingMode) {
    setCameraMessage("");
    if (typeof window === "undefined" || !window.isSecureContext) {
      setCameraMessage("secureCamera");
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraMessage("cameraUnsupported");
      return;
    }
    stopCamera();
    const requestId = cameraRequestRef.current;
    try {
      const nextStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: mode } }, audio: false });
      if (requestId !== cameraRequestRef.current) {
        nextStream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = nextStream;
      setStream(nextStream);
    } catch (error) {
      if (requestId === cameraRequestRef.current) setCameraMessage(cameraErrorKey(error) as MessageKey);
    }
  }

  async function capturePhoto() {
    const video = videoRef.current;
    if (!video?.videoWidth || !video.videoHeight) {
      setCameraMessage("cameraWait");
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.92));
    if (!blob) { setCameraMessage("cameraCaptureFailed"); return; }
    const file = new File([blob], `camera-${Date.now()}.jpg`, { type: "image/jpeg", lastModified: Date.now() });
    selectFile(file);
  }

  function clearSelection() {
    if (pending) return;
    setSelectedFile(null);
    setSourceFile(null);
    setCropData(null);
    setPreviewUrl(null);
    setSelectionError("");
    onPreviewChange?.(null);
    onDraftChange?.(false);
    submittingRef.current = false;
    if (inputRef.current) inputRef.current.value = "";
    if (sourceInputRef.current) sourceInputRef.current.value = "";
  }

  function cancelCrop() {
    setCropFile(null);
    clearSelection();
    triggerRef.current?.focus();
  }

  const displayedUrl = externalPreview ? null : previewUrl ?? currentPhotoUrl;

  return <div className="photo-acquisition">
    <input ref={inputRef} className="visually-hidden" type="file" name={name} accept="image/jpeg,image/png,image/webp" capture="environment" aria-hidden="true" tabIndex={-1} disabled={pending} onChange={(event) => {
      const file = event.currentTarget.files?.[0];
      if (file) selectFile(file);
    }}/>
    <input ref={sourceInputRef} className="visually-hidden" type="file" name={`${name}Source`} aria-hidden="true" tabIndex={-1} disabled={pending}/>
    <input type="hidden" name="crop" value={cropData ? JSON.stringify(cropData) : ""}/>
    {displayedUrl ? <div className="photo-preview-frame"><PrivateImage variant="preview" className="photo-preview" src={displayedUrl} alt={selectedFile ? t("photoPreviewSelected") : t("photo")}/></div> : null}
    <div className="photo-acquisition-actions">
      <button ref={triggerRef} type="button" className={currentPhotoUrl ? "photo-acquisition-secondary" : "photo-acquisition-primary photo-add-primary"} disabled={pending} onClick={() => { setSourceOpen(true); setCameraMessage(""); }}>
        {currentPhotoUrl ? <RefreshCw size={16} aria-hidden="true"/> : <ImagePlus size={16} aria-hidden="true"/>}
        <span>{pending ? t("savingPhoto") : selectedFile ? t("chooseAnotherPhoto") : currentPhotoUrl ? t("replacePhoto") : t("addPhoto")}</span>
      </button>
      {currentPhotoUrl && !pending && !selectedFile ? <button type="button" className="photo-acquisition-primary photo-edit-primary" onClick={() => void editCurrentPhoto()}><Pencil size={16} aria-hidden="true"/><span>{t("editCrop")}</span></button> : null}
      {selectedFile && !pending && !autoSubmit ? <button type="button" className="text-button" onClick={clearSelection}>{t("removeSelection")}</button> : null}
      {selectedFile && !pending && autoSubmit ? <button type="button" className="text-button" onClick={clearSelection}>{t("cancelSelection")}</button> : null}
      {selectedFile && retryReady && !pending ? <button type="button" className="quiet-button" onClick={() => { submittingRef.current = true; inputRef.current?.form?.requestSubmit(); }}>{t("retryUpload")}</button> : null}
    </div>
    {selectedFile ? <p className="photo-file-caption">{t("photoChosen", { name: selectedFile.name, size: new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(selectedFile.size / (1024 * 1024)) })}</p> : null}
    {selectionError ? <p className="form-error" role="alert">{t(selectionError)}</p> : null}
    {pending ? <p className="inline-status" role="status" aria-live="polite">{t("photoPending")}</p> : null}
    {sourceOpen ? <div className="photo-source-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeSources(); }}>
      <section ref={dialogRef} className="photo-source-dialog" role="dialog" aria-modal="true" aria-labelledby="photo-source-title" onKeyDown={(event) => {
        if (event.key !== "Tab") return;
        const focusable = Array.from(event.currentTarget.querySelectorAll<HTMLElement>("button:not([disabled])"));
        const first = focusable[0]; const last = focusable.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }}>
        <div className="dialog-heading"><h3 id="photo-source-title">{stream ? t("cameraCapture") : t("photo")}</h3><button type="button" className="icon-button" aria-label={t("close")} onClick={closeSources}><X size={18} aria-hidden="true"/></button></div>
        {stream ? <>
          <video ref={videoRef} className="camera-preview" autoPlay playsInline muted aria-label={t("photo")}/>
          {cameraMessage ? <p className="form-error" role="alert">{t(cameraMessage)}</p> : null}
          <div className="dialog-actions"><button type="button" className="quiet-button" onClick={() => void capturePhoto()}>{t("cameraCapture")}</button><button type="button" className="text-button" onClick={() => { const next = facingMode === "environment" ? "user" : "environment"; setFacingMode(next); void startCamera(next); }}>{t("switchCamera")}</button><button type="button" className="text-button" onClick={closeSources}>{t("cancel")}</button></div>
        </> : <>
          <p className="dialog-copy">{t("photoOnlyDevice")}</p>
          {cameraMessage ? <p className="form-error" role="alert">{t(cameraMessage)}</p> : null}
          <div className="dialog-actions"><button type="button" className="quiet-button" onClick={() => void startCamera()}>{t("cameraOpen")}</button><button type="button" className="quiet-button" onClick={() => inputRef.current?.click()}>{t("chooseFile")}</button><button type="button" className="text-button" onClick={closeSources}>{t("cancel")}</button></div>
        </>}
      </section>
    </div> : null}
    {cropFile ? <PhotoCropper file={cropFile} onConfirm={confirmCrop} onCancel={cancelCrop} onUseOriginal={useOriginalPhoto}/> : null}
  </div>;
}
