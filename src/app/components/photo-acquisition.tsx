"use client";

import { PrivateImage } from "./private-image";

import { useEffect, useRef, useState } from "react";
import { useSubmissionPending } from "./action-form";
import type { MessageKey } from "@/i18n/messages";
import type CropperJS from "cropperjs";
import { ImagePlus, Pencil, RefreshCw, X } from "lucide-react";
import { PhotoCropper } from "./photo-cropper";
import { useI18n } from "@/i18n/provider";
import {PhotoInputError,preflightPhoto} from "@/media/browser-photo";

const maxBytes = 10 * 1024 * 1024;
const acceptedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
type CropData = CropperJS.Data;
export type PhotoDraft = { selected: File | null; source: File | null; pending: File | null; crop: CropData | null; pendingCrop?:CropData|null };

type Props = {
  multiple?:boolean;
  disabled?:boolean;
  active?:boolean;
  hideAcquire?:boolean;
  hideRemove?:boolean;
  onAcquireFiles?:(files:File[])=>void|Promise<void>;
  name?: string;
  currentPhotoUrl?: string | null;
  autoSubmit?: boolean;
  savedToken?: string;
  resultToken?: string;
  retryReady?: boolean;
  externalPreview?: boolean;
  initialCrop?: CropData | null;
  onPreviewChange?: (url: string | null) => void;
  onDraftChange?: (dirty: boolean) => void;
  resetToken?: number;
  recovery?: { token: number; photo: PhotoDraft } | null;
  onRecoveryChange?: (photo: PhotoDraft | null) => void|boolean;
};

function cameraErrorKey(error: unknown) {
  if (error instanceof DOMException) {
    if (error.name === "NotAllowedError" || error.name === "SecurityError") return "cameraDenied";
    if (error.name === "NotFoundError" || error.name === "OverconstrainedError") return "cameraMissing";
    if (error.name === "NotReadableError" || error.name === "AbortError") return "cameraBusy";
  }
  return "cameraUnavailable";
}

export function PhotoAcquisition({ name = "photo", currentPhotoUrl = null, autoSubmit = false, savedToken, resultToken, retryReady = false, externalPreview = false, initialCrop, onPreviewChange, onDraftChange, resetToken, recovery, onRecoveryChange, multiple=false, disabled=false, active=true, hideAcquire=false, hideRemove=false, onAcquireFiles }: Props) {
  const { t } = useI18n();
  const inputRef = useRef<HTMLInputElement>(null);
  const sourceInputRef = useRef<HTMLInputElement>(null);
  const cropInputRef=useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const cameraRequestRef = useRef(0);
  const submittingRef = useRef(false);
  const selectionRequest=useRef(0),capturing=useRef(false),alive=useRef(true);
  const [checking,setChecking]=useState(false),[captureBusy,setCaptureBusy]=useState(false);
  const appliedSavedToken=useRef<string|undefined>(undefined);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [cropData, setCropData] = useState<CropData | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [pendingCrop,setPendingCrop]=useState<CropData|null>(null);
  const [sourceOpen, setSourceOpen] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraMessage, setCameraMessage] = useState<MessageKey|"">("");
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [selectionError, setSelectionError] = useState<MessageKey|"">("");
  const pending = useSubmissionPending()||disabled||checking;
  useEffect(() => { if (!pending) submittingRef.current = false; }, [pending]);

  useEffect(() => { onDraftChange?.(Boolean(selectedFile || cropFile || sourceOpen||checking)); }, [selectedFile,cropFile,sourceOpen,checking,onDraftChange]);

  useEffect(() => {
    if (!previewUrl) return;
    return () => URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  useEffect(() => {
    submittingRef.current = false;
    if (!savedToken) return;
    if(appliedSavedToken.current===savedToken)return;
    appliedSavedToken.current=savedToken;
    setSelectedFile(null);
    setSourceFile(null);
    setCropData(null);
    setPendingCrop(null);
    setPreviewUrl(null);
    onPreviewChange?.(null);
    if (inputRef.current) inputRef.current.value = "";
    if (sourceInputRef.current) sourceInputRef.current.value = "";
    onDraftChange?.(false);
  }, [savedToken, resultToken, onPreviewChange]);

  useEffect(() => { if (resetToken) clearSelection(); }, [resetToken]);

  useEffect(() => {
    if (!recovery) return;
    const { selected, source, pending: pendingCrop, crop } = recovery.photo;
    setSelectedFile(selected); setSourceFile(source); setCropData(crop); setCropFile(pendingCrop);
    setPendingCrop(recovery.photo.pendingCrop??null);
    if (selected) { setInputFile(inputRef, selected); setPreviewUrl(URL.createObjectURL(selected)); }
    if (source) setInputFile(sourceInputRef, source);
    onDraftChange?.(Boolean(selected || pendingCrop));
  // A token represents one explicit restore, not subsequent parent renders.
  }, [recovery?.token]);

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

  useEffect(() => {alive.current=true;return()=>{alive.current=false;selectionRequest.current++;cameraRequestRef.current += 1; streamRef.current?.getTracks().forEach((track) => track.stop());};}, []);
  useEffect(()=>{if(!active)closeSources();},[active]);

  function stopCamera() {
    cameraRequestRef.current += 1;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setStream(null);
  }

  function closeSources() {
    selectionRequest.current++;
    setChecking(false);
    stopCamera();
    setSourceOpen(false);
    triggerRef.current?.focus();
  }

  function setInputFile(ref: React.RefObject<HTMLInputElement | null>, file: File) {
    const transfer = new DataTransfer();
    transfer.items.add(file);
    if (ref.current) ref.current.files = transfer.files;
  }

  async function selectFile(file: File) {
    if(onAcquireFiles){closeSources();void Promise.resolve(onAcquireFiles([file])).catch(()=>setSelectionError("photoSelectionFailed"));return;}
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
    const request=++selectionRequest.current;setChecking(true);
    try{file=await preflightPhoto(file);if(request!==selectionRequest.current||!alive.current)return;}
    catch(error){if(alive.current&&request===selectionRequest.current){setSelectionError(error instanceof PhotoInputError?error.code:"photoSelectionFailed");if(selectedFile)setInputFile(inputRef,selectedFile);else if(inputRef.current)inputRef.current.value="";}return;}
    finally{if(alive.current&&request===selectionRequest.current)setChecking(false);}
    setSelectionError("");
    closeSources();
    setSavedCrop(null);
    setPendingCrop(null);
    setCropFile(file);
    onRecoveryChange?.({ selected: selectedFile, source: sourceFile, pending: file, crop: cropData });
  }

  function acceptSelection(file: File, data: CropData | null) {
    const original = cropFile ?? file;
    if(onRecoveryChange?.({selected:file,source:original,pending:null,crop:data,pendingCrop:null})===false)return false;
    setCropFile(null);
    setPendingCrop(null);
    triggerRef.current?.focus();
    setInputFile(inputRef, file);
    setInputFile(sourceInputRef, original);
    setSourceFile(original);
    setSelectedFile(file);
    setCropData(data);
    // File inputs and accepted crop metadata must enter the same automatic submit.
    if(cropInputRef.current)cropInputRef.current.value=data?JSON.stringify(data):"";
    onDraftChange?.(true);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    onPreviewChange?.(url);
    if (autoSubmit && !submittingRef.current) {
      submittingRef.current = true;
      queueMicrotask(() => inputRef.current?.form?.requestSubmit());
    }
    return true;
  }

  function confirmCrop(file: File, data: CropData) {
    return acceptSelection(file, data);
  }

  function useOriginalPhoto() {
    const original = cropFile ?? sourceFile;
    if (!original) { cancelCrop(); return; }
    return acceptSelection(original, null);
  }

  const [savedCrop, setSavedCrop] = useState<CropData | null>(null);

  async function editCurrentPhoto() {
    if (selectedFile) {
      const original = sourceFile ?? selectedFile;
      setSelectionError("");
      setCropFile(original);
      setPendingCrop(cropData);
      onRecoveryChange?.({ selected: selectedFile, source: original, pending: original, crop: cropData,pendingCrop:cropData });
      return;
    }
    if (!currentPhotoUrl) return;
    setSelectionError("");
    try {
      const response = await fetch(`${currentPhotoUrl}&variant=source`, { cache: "no-store" });
      if (!response.ok) throw new Error("Photo unavailable");
      const blob = await response.blob();
      const file = new File([blob], "saved-photo.webp", { type: blob.type || "image/webp", lastModified: Date.now() });
      setSavedCrop(initialCrop ?? null);
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
    if(capturing.current)return;
    const video = videoRef.current;
    if (!video?.videoWidth || !video.videoHeight) {
      setCameraMessage("cameraWait");
      return;
    }
    if(video.videoWidth>12_000||video.videoHeight>12_000||video.videoWidth*video.videoHeight>40_000_000){setCameraMessage("photoPixelLimit");return;}
    capturing.current=true;setCaptureBusy(true);const request=cameraRequestRef.current;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    try{
      const context=canvas.getContext("2d");if(!context)throw new Error("Camera canvas unavailable");context.drawImage(video,0,0);
      const blob=await new Promise<Blob|null>((resolve,reject)=>{const timeout=setTimeout(()=>reject(new Error("Camera encoding timeout")),20_000);try{canvas.toBlob(result=>{clearTimeout(timeout);resolve(result);},"image/jpeg",.92);}catch(error){clearTimeout(timeout);reject(error);}});
      if(request!==cameraRequestRef.current||!alive.current)return;
      if(!blob)throw new Error("Camera encoding failed");
      await selectFile(new File([blob],`camera-${Date.now()}.jpg`,{type:"image/jpeg",lastModified:Date.now()}));
    }catch{if(alive.current&&request===cameraRequestRef.current)setCameraMessage("cameraCaptureFailed");}
    finally{capturing.current=false;if(alive.current)setCaptureBusy(false);canvas.width=0;canvas.height=0;}
  }

  function clearSelection() {
    if (pending) return;
    selectionRequest.current++;
    setSelectedFile(null);
    setSourceFile(null);
    setCropData(null);
    setPendingCrop(null);
    setCropFile(null);
    setPreviewUrl(null);
    setSelectionError("");
    onPreviewChange?.(null);
    onDraftChange?.(false);
    onRecoveryChange?.(null);
    submittingRef.current = false;
    if (inputRef.current) inputRef.current.value = "";
    if (sourceInputRef.current) sourceInputRef.current.value = "";
  }

  function cancelCrop() {
    setCropFile(null);
    setPendingCrop(null);
    onRecoveryChange?.(selectedFile ? { selected: selectedFile, source: sourceFile, pending: null, crop: cropData,pendingCrop:null } : null);
    if (selectedFile) setInputFile(inputRef, selectedFile);
    else if (inputRef.current) inputRef.current.value = "";
    triggerRef.current?.focus();
  }

  const displayedUrl = externalPreview ? null : previewUrl ?? currentPhotoUrl;

  return <div className="photo-acquisition">
    <input ref={inputRef} className="visually-hidden" type="file" name={name} accept="image/jpeg,image/png,image/webp" capture={multiple?undefined:"environment"} multiple={multiple} aria-hidden="true" tabIndex={-1} disabled={pending} onChange={(event) => {
      if(onAcquireFiles){const input=event.currentTarget;closeSources();void Promise.resolve(onAcquireFiles([...input.files??[]])).catch(()=>setSelectionError("photoSelectionFailed")).finally(()=>{input.value="";});return;}
      const file = event.currentTarget.files?.[0];
      if (file) void selectFile(file);
    }}/>
    <input ref={sourceInputRef} className="visually-hidden" type="file" name={`${name}Source`} aria-hidden="true" tabIndex={-1} disabled={pending}/>
    <input ref={cropInputRef} type="hidden" name="crop" value={cropData ? JSON.stringify(cropData) : ""}/>
    {displayedUrl ? <div className="photo-preview-frame"><PrivateImage variant="preview" className="photo-preview" src={displayedUrl} alt={selectedFile ? t("photoPreviewSelected") : t("photo")}/></div> : null}
    <div className="photo-acquisition-actions">
      {!hideAcquire?<button ref={triggerRef} type="button" className={currentPhotoUrl ? "photo-acquisition-secondary" : "photo-acquisition-primary photo-add-primary"} disabled={pending} onClick={() => { setSourceOpen(true); setCameraMessage(""); }}>
        {currentPhotoUrl ? <RefreshCw size={16} aria-hidden="true"/> : <ImagePlus size={16} aria-hidden="true"/>}
        <span>{checking?t("creationReadingPhotos"):pending&&autoSubmit ? t("savingPhoto") : selectedFile ? t("chooseAnotherPhoto") : currentPhotoUrl ? t("replacePhoto") : t("addPhoto")}</span>
      </button>:null}
      {(currentPhotoUrl || selectedFile) && !pending ? <button ref={hideAcquire?triggerRef:undefined} type="button" className="photo-acquisition-primary photo-edit-primary" onClick={() => void editCurrentPhoto()}><Pencil size={16} aria-hidden="true"/><span>{t("editCrop")}</span></button> : null}
      {selectedFile && !pending && !autoSubmit&&!hideRemove ? <button type="button" className="text-button" onClick={clearSelection}>{t("removeSelection")}</button> : null}
      {selectedFile && !pending && autoSubmit&&!hideRemove ? <button type="button" className="text-button" onClick={clearSelection}>{t("cancelSelection")}</button> : null}
      {selectedFile && retryReady && !pending ? <button type="button" className="quiet-button" onClick={() => { submittingRef.current = true; inputRef.current?.form?.requestSubmit(); }}>{t("retryUpload")}</button> : null}
    </div>
    {selectionError&&!sourceOpen ? <p className="form-error" role="alert">{t(selectionError)}</p> : null}
    {checking?<p className="inline-status" role="status">{t("creationReadingPhotos")}</p>:pending&&autoSubmit ? <p className="inline-status" role="status" aria-live="polite">{t("photoPending")}</p> : null}
    {sourceOpen ? <div className="photo-source-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeSources(); }}>
      <section ref={dialogRef} className="photo-source-dialog" role="dialog" aria-modal="true" aria-labelledby="photo-source-title" onKeyDown={(event) => {
        if (event.key !== "Tab") return;
        const focusable = Array.from(event.currentTarget.querySelectorAll<HTMLElement>("button:not([disabled])"));
        const first = focusable[0]; const last = focusable.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }}>
        <div className="dialog-heading"><h3 id="photo-source-title">{stream ? t("cameraCapture") : t("photo")}</h3><button type="button" className="icon-button" aria-label={t("close")} onClick={closeSources}><X size={18} aria-hidden="true"/></button></div>
        <div className="dialog-scroll-body">{stream ? <>
          <video ref={videoRef} className="camera-preview" autoPlay playsInline muted aria-label={t("photo")}/>
          {cameraMessage ? <p className="form-error" role="alert">{t(cameraMessage)}</p> : null}
          <div className="dialog-actions"><button type="button" className="quiet-button" disabled={captureBusy} onClick={() => void capturePhoto()}>{captureBusy?t("creationReadingPhotos"):t("cameraCapture")}</button><button type="button" className="text-button" disabled={captureBusy} onClick={() => { const next = facingMode === "environment" ? "user" : "environment"; setFacingMode(next); void startCamera(next); }}>{t("switchCamera")}</button></div>
        </> : <>
          <p className="dialog-copy">{t("photoOnlyDevice")}</p>
          {cameraMessage ? <p className="form-error" role="alert">{t(cameraMessage)}</p> : null}
          {selectionError?<p className="form-error" role="alert">{t(selectionError)}</p>:null}
          {checking?<p role="status">{t("creationReadingPhotos")}</p>:null}
          <div className="dialog-actions"><button type="button" className="quiet-button" disabled={pending} onClick={() => void startCamera()}>{t("cameraOpen")}</button><button type="button" className="quiet-button" disabled={pending} onClick={() => inputRef.current?.click()}>{t("chooseFile")}</button></div>
        </>}</div>
      </section>
    </div> : null}
    {active&&cropFile ? <PhotoCropper initialCrop={pendingCrop??(cropFile === sourceFile ? cropData : selectedFile ? null : savedCrop)} onCropChange={data=>{setPendingCrop(data);onRecoveryChange?.({selected:selectedFile,source:sourceFile,pending:cropFile,crop:cropData,pendingCrop:data});}} file={cropFile} onConfirm={confirmCrop} onCancel={cancelCrop} onUseOriginal={useOriginalPhoto}/> : null}
  </div>;
}
