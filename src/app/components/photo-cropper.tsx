"use client";

import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { cropFromDrag, moveCropRect, zoomCropRect, type CropRect } from "@/media/crop";
import { useI18n } from "@/i18n/provider";

type Bounds = { width: number; height: number; scale: number; left: number; top: number };

function clamp(value: number, min: number, max: number) { return Math.min(max, Math.max(min, value)); }

export function PhotoCropper({ file, onConfirm, onCancel }: { file: File; onConfirm: (file: File) => void; onCancel: () => void }) {
  const { locale, t } = useI18n();
  const imageRef = useRef<HTMLImageElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const dragRef = useRef<{ mode: "draw" | "move"; startX: number; startY: number; startRect: CropRect } | null>(null);
  const [bounds, setBounds] = useState<Bounds | null>(null);
  const [selection, setSelection] = useState<CropRect | null>(null);
  const [zoom, setZoom] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sourceUrl] = useState(() => URL.createObjectURL(file));

  const measure = useCallback(() => {
    const image = imageRef.current;
    const viewport = viewportRef.current;
    if (!image?.naturalWidth || !image.naturalHeight || !viewport) return;
    const scale = Math.min(viewport.clientWidth / image.naturalWidth, viewport.clientHeight / image.naturalHeight);
    const width = image.naturalWidth * scale;
    const height = image.naturalHeight * scale;
    setBounds({ width, height, scale, left: (viewport.clientWidth - width) / 2, top: (viewport.clientHeight - height) / 2 });
    setSelection((current) => current ?? { x: 0, y: 0, width: image.naturalWidth, height: image.naturalHeight });
  }, []);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const observer = new ResizeObserver(measure);
    observer.observe(viewport);
    measure();
    return () => observer.disconnect();
  }, [measure]);

  useEffect(() => () => URL.revokeObjectURL(sourceUrl), [sourceUrl]);
  useEffect(() => { dialogRef.current?.querySelector<HTMLElement>("button:not([disabled])")?.focus(); }, []);

  function imagePoint(clientX: number, clientY: number) {
    const box = viewportRef.current?.getBoundingClientRect();
    const image = imageRef.current;
    if (!box || !image || !bounds) return null;
    return {
      x: clamp((clientX - box.left - bounds.left) / bounds.scale, 0, image.naturalWidth),
      y: clamp((clientY - box.top - bounds.top) / bounds.scale, 0, image.naturalHeight),
    };
  }

  function pointerDown(event: PointerEvent<HTMLDivElement>) {
    const point = imagePoint(event.clientX, event.clientY);
    const image = imageRef.current;
    if (!point || !image) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const current = selection ?? { x: 0, y: 0, width: image.naturalWidth, height: image.naturalHeight };
    const inside = point.x >= current.x && point.x <= current.x + current.width && point.y >= current.y && point.y <= current.y + current.height;
    const fullSelection = current.width >= image.naturalWidth - 1 && current.height >= image.naturalHeight - 1;
    dragRef.current = { mode: inside && !fullSelection ? "move" : "draw", startX: point.x, startY: point.y, startRect: current };
    if (!inside || fullSelection) setSelection({ x: point.x, y: point.y, width: 1, height: 1 });
  }

  function pointerMove(event: PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    const point = imagePoint(event.clientX, event.clientY);
    const image = imageRef.current;
    if (!drag || !point || !image) return;
    if (drag.mode === "draw") {
      setSelection(cropFromDrag({ x: drag.startX, y: drag.startY }, point, image.naturalWidth, image.naturalHeight));
    } else {
      setSelection(moveCropRect(drag.startRect, point.x - drag.startX, point.y - drag.startY, image.naturalWidth, image.naturalHeight));
    }
  }

  function pointerUp() { dragRef.current = null; }

  function setZoomValue(nextZoom: number) {
    if (!selection || !imageRef.current) return;
    const next = clamp(nextZoom, 1, 4);
    setSelection(zoomCropRect(selection, next / zoom, imageRef.current.naturalWidth, imageRef.current.naturalHeight));
    setZoom(next);
  }

  function reset() {
    const image = imageRef.current;
    if (!image) return;
    setSelection({ x: 0, y: 0, width: image.naturalWidth, height: image.naturalHeight });
    setZoom(1); setError("");
  }

  function onCropKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!selection || !imageRef.current) return;
    const step = (event.shiftKey ? 10 : 1) / zoom;
    if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) {
      event.preventDefault();
      setSelection({ ...selection,
        x: clamp(selection.x + (event.key === "ArrowLeft" ? -step : event.key === "ArrowRight" ? step : 0), 0, imageRef.current.naturalWidth - selection.width),
        y: clamp(selection.y + (event.key === "ArrowUp" ? -step : event.key === "ArrowDown" ? step : 0), 0, imageRef.current.naturalHeight - selection.height),
      });
    } else if (event.key === "+" || event.key === "=") { event.preventDefault(); setZoomValue(zoom + 0.25); }
    else if (event.key === "-") { event.preventDefault(); setZoomValue(zoom - 0.25); }
  }

  async function confirm() {
    const image = imageRef.current;
    if (!image || !selection || busy) return;
    setBusy(true); setError("");
    try {
      if (selection.x <= 1 && selection.y <= 1 && selection.width >= image.naturalWidth - 1 && selection.height >= image.naturalHeight - 1) {
        onConfirm(file);
        return;
      }
      const canvas = document.createElement("canvas");
      if (selection.width < 64 || selection.height < 64) throw new Error("crop is too small");
      canvas.width = Math.max(1, Math.round(selection.width));
      canvas.height = Math.max(1, Math.round(selection.height));
      const context = canvas.getContext("2d");
      if (!context) throw new Error("canvas unavailable");
      context.drawImage(image, selection.x, selection.y, selection.width, selection.height, 0, 0, canvas.width, canvas.height);
      const mimeType = file.type === "image/png" ? "image/png" : "image/jpeg";
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, mimeType, 0.94));
      if (!blob) throw new Error("crop failed");
      const extension = mimeType === "image/png" ? "png" : "jpg";
      onConfirm(new File([blob], `edited-${file.name.replace(/\.[^.]+$/, "")}.${extension}`, { type: mimeType, lastModified: Date.now() }));
    } catch {
      setError(selection.width < 64 || selection.height < 64 ? t("cropTooSmall") : t("cropFailed"));
      setBusy(false);
    }
  }

  const rectStyle = bounds && selection ? {
    left: bounds.left + selection.x * bounds.scale,
    top: bounds.top + selection.y * bounds.scale,
    width: selection.width * bounds.scale,
    height: selection.height * bounds.scale,
  } : undefined;

  return <div className="photo-source-overlay crop-overlay" role="presentation">
    <section ref={dialogRef} className="photo-source-dialog crop-dialog" role="dialog" aria-modal="true" aria-labelledby="crop-title" aria-describedby="crop-help" onKeyDown={(event) => {
      if (event.key === "Escape" && !busy) { onCancel(); return; }
      if (event.key !== "Tab") return;
      const focusable = Array.from(event.currentTarget.querySelectorAll<HTMLElement>("button:not([disabled]),input:not([disabled]),[tabindex='0']"));
      const first = focusable[0]; const last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }}>
      <div className="dialog-heading"><h3 id="crop-title">{t("cropTitle")}</h3><button type="button" className="icon-button" aria-label={t("cancelCropAria")} disabled={busy} onClick={onCancel}>×</button></div>
      <p id="crop-help" className="crop-help">{t("cropHelp")}</p>
      <div ref={viewportRef} className="crop-viewport" onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={pointerUp}>
        <img ref={imageRef} className="crop-source-image" src={sourceUrl} alt={t("cropSourceAlt")} onLoad={measure}/>
        {rectStyle ? <div className="crop-selection" style={rectStyle} tabIndex={0} role="group" aria-label={t("cropKeyboardHelp")} onKeyDown={onCropKeyDown}/> : null}
      </div>
      <label className="crop-zoom"><span>{t("cropZoom")}</span><input type="range" min={1} max={4} step={0.1} value={zoom} aria-valuetext={`${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(zoom)}×`} onChange={(event) => setZoomValue(Number(event.target.value))}/><output>{new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(zoom)}×</output></label>
      {error ? <p className="form-error" role="alert">{error}</p> : null}
      <div className="dialog-actions crop-actions"><button type="button" className="text-button" disabled={busy} onClick={reset}>{t("cropReset")}</button><button type="button" className="text-button" disabled={busy} onClick={onCancel}>{t("cancel")}</button><button type="button" className="quiet-button" disabled={busy || !selection} onClick={() => void confirm()}>{busy ? t("cropPreparing") : t("cropConfirm")}</button></div>
    </section>
  </div>;
}
