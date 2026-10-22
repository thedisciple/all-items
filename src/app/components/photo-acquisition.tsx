"use client";

import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { PhotoCropper } from "./photo-cropper";
import { useI18n } from "@/i18n/provider";

const maxBytes = 10 * 1024 * 1024;
const acceptedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

type Props = {
  name?: string;
  currentPhotoUrl?: string | null;
  autoSubmit?: boolean;
  savedToken?: string;
  resultToken?: string;
  retryReady?: boolean;
  externalPreview?: boolean;
  onPreviewChange?: (url: string | null) => void;
};

function cameraErrorKey(error: unknown) {
  if (error instanceof DOMException) {
    if (error.name === "NotAllowedError" || error.name === "SecurityError") return "cameraDenied";
    if (error.name === "NotFoundError" || error.name === "OverconstrainedError") return "cameraMissing";
    if (error.name === "NotReadableError" || error.name === "AbortError") return "cameraBusy";
  }
  return "cameraUnavailable";
}

export function PhotoAcquisition({ name = "photo", currentPhotoUrl = null, autoSubmit = false, savedToken, resultToken, retryReady = false, externalPreview = false, onPreviewChange }: Props) {
  const { locale, t } = useI18n();
  const inputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const cameraRequestRef = useRef(0);
  const submittingRef = useRef(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [sourceOpen, setSourceOpen] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraMessage, setCameraMessage] = useState("");
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [selectionError, setSelectionError] = useState("");
  const { pending } = useFormStatus();

  useEffect(() => {
    if (!previewUrl) return;
    return () => URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  useEffect(() => {
    submittingRef.current = false;
    if (!savedToken) return;
    setSelectedFile(null);
    setPreviewUrl(null);
    onPreviewChange?.(null);
    if (inputRef.current) inputRef.current.value = "";
  }, [savedToken, resultToken, onPreviewChange]);

  useEffect(() => {
    if (!stream || !videoRef.current) return;
    videoRef.current.srcObject = stream;
    void videoRef.current.play().catch(() => setCameraMessage(t("photoPreviewFailed")));
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

  function setInputFile(file: File) {
    const transfer = new DataTransfer();
    transfer.items.add(file);
    if (inputRef.current) inputRef.current.files = transfer.files;
  }

  function selectFile(file: File) {
    if (file.size > maxBytes) {
      setSelectionError(t("photoFileTooLarge"));
      if (selectedFile) setInputFile(selectedFile);
      else if (inputRef.current) inputRef.current.value = "";
      return;
    }
    if (file.type && !acceptedTypes.has(file.type)) {
      setSelectionError(t("photoTypeInvalid"));
      if (selectedFile) setInputFile(selectedFile);
      else if (inputRef.current) inputRef.current.value = "";
      return;
    }
    setSelectionError("");
    closeSources();
    setSelectedFile(null);
    setPreviewUrl(null);
    onPreviewChange?.(null);
    setCropFile(file);
  }

  function confirmCrop(file: File) {
    setCropFile(null);
    triggerRef.current?.focus();
    setInputFile(file);
    setSelectedFile(file);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    onPreviewChange?.(url);
    if (autoSubmit && !submittingRef.current) {
      submittingRef.current = true;
      queueMicrotask(() => inputRef.current?.form?.requestSubmit());
    }
  }

  async function editCurrentPhoto() {
    if (!currentPhotoUrl) return;
    setSelectionError("");
    try {
      const response = await fetch(currentPhotoUrl, { cache: "no-store" });
      if (!response.ok) throw new Error("Photo unavailable");
      const blob = await response.blob();
      const file = new File([blob], "saved-photo.webp", { type: blob.type || "image/webp", lastModified: Date.now() });
      setSelectedFile(null);
      setPreviewUrl(null);
      onPreviewChange?.(null);
      setCropFile(file);
    } catch {
      setSelectionError(t("photoSelectionFailed"));
    }
  }

  async function startCamera(mode = facingMode) {
    setCameraMessage("");
    if (typeof window === "undefined" || !window.isSecureContext) {
      setCameraMessage(t("secureCamera"));
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraMessage(t("cameraUnsupported"));
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
      if (requestId === cameraRequestRef.current) setCameraMessage(t(cameraErrorKey(error) as Parameters<typeof t>[0]));
    }
  }

  async function capturePhoto() {
    const video = videoRef.current;
    if (!video?.videoWidth || !video.videoHeight) {
      setCameraMessage(t("cameraWait"));
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.92));
    if (!blob) { setCameraMessage(t("cameraCaptureFailed")); return; }
    const file = new File([blob], `camera-${Date.now()}.jpg`, { type: "image/jpeg", lastModified: Date.now() });
    selectFile(file);
  }

  function clearSelection() {
    if (pending) return;
    setSelectedFile(null);
    setPreviewUrl(null);
    setSelectionError("");
    onPreviewChange?.(null);
    submittingRef.current = false;
    if (inputRef.current) inputRef.current.value = "";
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
    {displayedUrl ? <div className="photo-preview-frame"><img className="photo-preview" src={displayedUrl} alt={selectedFile ? t("photoPreviewSelected") : t("photo")}/></div> : null}
    <p className="photo-guidance">{t("photoGuidance")}</p>
    <div className="photo-acquisition-actions">
      <button ref={triggerRef} type="button" className={displayedUrl ? "quiet-button" : "photo-source-button"} disabled={pending} onClick={() => { setSourceOpen(true); setCameraMessage(""); }}>
        {pending ? t("savingPhoto") : selectedFile ? t("chooseAnotherPhoto") : currentPhotoUrl ? t("replacePhoto") : t("addPhoto")}
      </button>
      {selectedFile && !pending && !autoSubmit ? <button type="button" className="text-button" onClick={clearSelection}>{t("removeSelection")}</button> : null}
      {selectedFile && !pending && autoSubmit ? <button type="button" className="text-button" onClick={clearSelection}>{t("cancelSelection")}</button> : null}
      {selectedFile && retryReady && !pending ? <button type="button" className="quiet-button" onClick={() => { submittingRef.current = true; inputRef.current?.form?.requestSubmit(); }}>{t("retryUpload")}</button> : null}
      {currentPhotoUrl && !pending && !selectedFile ? <button type="button" className="text-button" onClick={() => void editCurrentPhoto()}>{t("editCrop")}</button> : null}
    </div>
    {selectedFile ? <p className="photo-file-caption">{t("photoChosen", { name: selectedFile.name, size: new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(selectedFile.size / (1024 * 1024)) })}</p> : null}
    {selectionError ? <p className="form-error" role="alert">{selectionError}</p> : null}
    {pending ? <p className="inline-status" role="status" aria-live="polite">{t("photoPending")}</p> : null}
    {sourceOpen ? <div className="photo-source-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeSources(); }}>
      <section ref={dialogRef} className="photo-source-dialog" role="dialog" aria-modal="true" aria-labelledby="photo-source-title" onKeyDown={(event) => {
        if (event.key !== "Tab") return;
        const focusable = Array.from(event.currentTarget.querySelectorAll<HTMLElement>("button:not([disabled])"));
        const first = focusable[0]; const last = focusable.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }}>
        <div className="dialog-heading"><h3 id="photo-source-title">{stream ? t("cameraCapture") : t("photo")}</h3><button type="button" className="icon-button" aria-label={t("close")} onClick={closeSources}>×</button></div>
        {stream ? <>
          <video ref={videoRef} className="camera-preview" autoPlay playsInline muted aria-label={t("photo")}/>
          {cameraMessage ? <p className="form-error" role="alert">{cameraMessage}</p> : null}
          <div className="dialog-actions"><button type="button" className="quiet-button" onClick={() => void capturePhoto()}>{t("cameraCapture")}</button><button type="button" className="text-button" onClick={() => { const next = facingMode === "environment" ? "user" : "environment"; setFacingMode(next); void startCamera(next); }}>{t("switchCamera")}</button><button type="button" className="text-button" onClick={closeSources}>{t("cancel")}</button></div>
        </> : <>
          <p className="dialog-copy">{t("photoOnlyDevice")}</p>
          {cameraMessage ? <p className="form-error" role="alert">{cameraMessage}</p> : null}
          <div className="dialog-actions"><button type="button" className="quiet-button" onClick={() => void startCamera()}>{t("cameraOpen")}</button><button type="button" className="quiet-button" onClick={() => inputRef.current?.click()}>{t("chooseFile")}</button><button type="button" className="text-button" onClick={closeSources}>{t("cancel")}</button></div>
        </>}
      </section>
    </div> : null}
    {cropFile ? <PhotoCropper file={cropFile} onConfirm={confirmCrop} onCancel={cancelCrop}/> : null}
  </div>;
}
