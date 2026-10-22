"use client";

import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

const maxBytes = 10 * 1024 * 1024;
const acceptedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

type Props = {
  name?: string;
  currentPhotoUrl?: string | null;
  autoSubmit?: boolean;
  savedToken?: string;
  resultToken?: string;
  retryReady?: boolean;
};

function cameraError(error: unknown) {
  if (error instanceof DOMException) {
    if (error.name === "NotAllowedError" || error.name === "SecurityError") return "Нет доступа к камере. Разрешите доступ в настройках браузера или выберите файл.";
    if (error.name === "NotFoundError" || error.name === "OverconstrainedError") return "Камера не найдена. Выберите фотографию из файлов.";
    if (error.name === "NotReadableError" || error.name === "AbortError") return "Камера занята или недоступна. Закройте другое приложение с камерой или выберите файл.";
  }
  return "Не удалось открыть камеру. Выберите фотографию из файлов.";
}

export function PhotoAcquisition({ name = "photo", currentPhotoUrl = null, autoSubmit = false, savedToken, resultToken, retryReady = false }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const cameraRequestRef = useRef(0);
  const submittingRef = useRef(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
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
    if (inputRef.current) inputRef.current.value = "";
  }, [savedToken, resultToken]);

  useEffect(() => {
    if (!stream || !videoRef.current) return;
    videoRef.current.srcObject = stream;
    void videoRef.current.play().catch(() => setCameraMessage("Предпросмотр камеры не запустился. Выберите фотографию из файлов."));
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
      setSelectionError("Размер фотографии должен быть не более 10 МиБ.");
      if (selectedFile) setInputFile(selectedFile);
      else if (inputRef.current) inputRef.current.value = "";
      return;
    }
    if (file.type && !acceptedTypes.has(file.type)) {
      setSelectionError("Выберите фотографию JPEG, PNG или WebP.");
      if (selectedFile) setInputFile(selectedFile);
      else if (inputRef.current) inputRef.current.value = "";
      return;
    }
    setSelectionError("");
    setInputFile(file);
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    closeSources();
    if (autoSubmit && !submittingRef.current) {
      submittingRef.current = true;
      queueMicrotask(() => inputRef.current?.form?.requestSubmit());
    }
  }

  async function startCamera(mode = facingMode) {
    setCameraMessage("");
    if (typeof window === "undefined" || !window.isSecureContext) {
      setCameraMessage("Камера доступна только в защищённом контексте, например по HTTPS или на этом компьютере через localhost. Выберите файл.");
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraMessage("Этот браузер не поддерживает доступ к камере. Выберите файл.");
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
      if (requestId === cameraRequestRef.current) setCameraMessage(cameraError(error));
    }
  }

  async function capturePhoto() {
    const video = videoRef.current;
    if (!video?.videoWidth || !video.videoHeight) {
      setCameraMessage("Камера ещё не готова. Подождите немного или выберите файл.");
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.92));
    if (!blob) { setCameraMessage("Не удалось сделать снимок. Выберите файл."); return; }
    const file = new File([blob], `camera-${Date.now()}.jpg`, { type: "image/jpeg", lastModified: Date.now() });
    selectFile(file);
  }

  function clearSelection() {
    if (pending) return;
    setSelectedFile(null);
    setPreviewUrl(null);
    setSelectionError("");
    submittingRef.current = false;
    if (inputRef.current) inputRef.current.value = "";
  }

  const displayedUrl = previewUrl ?? currentPhotoUrl;

  return <div className="photo-acquisition">
    <input ref={inputRef} className="visually-hidden" type="file" name={name} accept="image/jpeg,image/png,image/webp" capture="environment" aria-hidden="true" tabIndex={-1} disabled={pending} onChange={(event) => {
      const file = event.currentTarget.files?.[0];
      if (file) selectFile(file);
    }}/>
    {displayedUrl ? <div className="photo-preview-frame"><img className="photo-preview" src={displayedUrl} alt={selectedFile ? "Предпросмотр выбранной фотографии" : "Текущая фотография вещи"}/></div> : null}
    {retryReady && selectedFile && currentPhotoUrl ? <div className="previous-photo-note"><img src={currentPhotoUrl} alt="Сохранённая фотография до замены"/><span>Сохранённое фото осталось без изменений</span></div> : null}
    <p className="photo-guidance">JPEG, PNG или WebP · исходный файл до 10 МиБ · изображение до 40 Мп и 12 000 пикселей по стороне. Оригинал не сохраняется.</p>
    <div className="photo-acquisition-actions">
      <button ref={triggerRef} type="button" className={displayedUrl ? "quiet-button" : "photo-source-button"} disabled={pending} onClick={() => { setSourceOpen(true); setCameraMessage(""); }}>
        {pending ? "Сохраняем фото…" : selectedFile ? "Выбрать другое фото" : currentPhotoUrl ? "Заменить фото" : "Добавить фото"}
      </button>
      {selectedFile && !pending && !autoSubmit ? <button type="button" className="text-button" onClick={clearSelection}>Убрать выбранное фото</button> : null}
      {selectedFile && !pending && autoSubmit ? <button type="button" className="text-button" onClick={clearSelection}>Отменить выбор</button> : null}
      {selectedFile && retryReady && !pending ? <button type="button" className="quiet-button" onClick={() => { submittingRef.current = true; inputRef.current?.form?.requestSubmit(); }}>Повторить сохранение</button> : null}
    </div>
    {selectedFile ? <p className="photo-file-caption">Выбрано: {selectedFile.name} · {(selectedFile.size / (1024 * 1024)).toFixed(1)} МБ</p> : null}
    {selectionError ? <p className="form-error" role="alert">{selectionError}</p> : null}
    {pending ? <p className="inline-status" role="status" aria-live="polite">Обрабатываем и сохраняем фотографию…</p> : null}
    {sourceOpen ? <div className="photo-source-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeSources(); }}>
      <section ref={dialogRef} className="photo-source-dialog" role="dialog" aria-modal="true" aria-labelledby="photo-source-title" onKeyDown={(event) => {
        if (event.key !== "Tab") return;
        const focusable = Array.from(event.currentTarget.querySelectorAll<HTMLElement>("button:not([disabled])"));
        const first = focusable[0]; const last = focusable.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }}>
        <div className="dialog-heading"><h3 id="photo-source-title">{stream ? "Сделать снимок" : "Добавить фотографию"}</h3><button type="button" className="icon-button" aria-label="Закрыть" onClick={closeSources}>×</button></div>
        {stream ? <>
          <video ref={videoRef} className="camera-preview" autoPlay playsInline muted aria-label="Предпросмотр камеры"/>
          {cameraMessage ? <p className="form-error" role="alert">{cameraMessage}</p> : null}
          <div className="dialog-actions"><button type="button" className="quiet-button" onClick={() => void capturePhoto()}>Сделать снимок</button><button type="button" className="text-button" onClick={() => { const next = facingMode === "environment" ? "user" : "environment"; setFacingMode(next); void startCamera(next); }}>Переключить камеру</button><button type="button" className="text-button" onClick={closeSources}>Отмена</button></div>
        </> : <>
          <p className="dialog-copy">Снимите предмет камерой или выберите готовое фото. Оригинал останется на этом устройстве.</p>
          {cameraMessage ? <p className="form-error" role="alert">{cameraMessage}</p> : null}
          <div className="dialog-actions"><button type="button" className="quiet-button" onClick={() => void startCamera()}>Открыть камеру</button><button type="button" className="quiet-button" onClick={() => inputRef.current?.click()}>Выбрать файл</button><button type="button" className="text-button" onClick={closeSources}>Отмена</button></div>
        </>}
      </section>
    </div> : null}
  </div>;
}
