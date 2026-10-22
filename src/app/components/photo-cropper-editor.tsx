"use client";

import Cropper from "react-cropper";
import type CropperJS from "cropperjs";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";

type Props = {
  file: File; sourceUrl: string; onConfirm: (file: File, crop: CropperJS.Data) => void; onCancel: () => void;
  cancelLabel: string; sourceAlt: string; title: string; help: string; confirmLabel: string; resetLabel: string;
  zoomLabel: string; aspectLabel: string; aspectFree: string; aspectOriginal: string; previewLabel: string; rotateLabel: string; movingLabel: string;
  resizingLabel: string; errorLabel: string; smallLabel: string; busyLabel: string;
  moveLeft: string; moveRight: string; moveUp: string; moveDown: string; shrinkWidth: string; growWidth: string; shrinkHeight: string; growHeight: string;
};
const ratios: Record<string, number | undefined> = { free: undefined, "1:1": 1, "4:3": 4 / 3, "3:2": 3 / 2, "16:9": 16 / 9 };

export default function PhotoCropperEditor(props: Props) {
  const cropper = useRef<CropperJS | null>(null);
  const fitRatio = useRef(1);
  const [zoom, setZoom] = useState(1);
  const [ratio, setRatio] = useState("free");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const dialogRef = useRef<HTMLElement>(null);

  useEffect(() => { dialogRef.current?.querySelector<HTMLElement>("button:not([disabled])")?.focus(); }, []);

  function onDialogKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === "Escape" && !busy) { props.onCancel(); return; }
    if (event.key !== "Tab") return;
    const focusable = Array.from(event.currentTarget.querySelectorAll<HTMLElement>("button:not([disabled]),input:not([disabled]),select:not([disabled])"));
    const first = focusable[0]; const last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }

  function updateAspect(next: string) {
    setRatio(next);
    const current = cropper.current;
    if (!current) return;
    const original = current.getImageData();
    current.setAspectRatio(next === "original" ? original.naturalWidth / original.naturalHeight : ratios[next] ?? Number.NaN);
  }

  function reset() {
    cropper.current?.reset();
    setZoom(1);
    setRatio("free");
    setError("");
  }

  function nudge(kind: "move" | "resize", dx: number, dy: number) {
    const instance = cropper.current;
    if (!instance) return;
    const data = instance.getData();
    const stepX = Math.max(1, data.width * 0.04);
    const stepY = Math.max(1, data.height * 0.04);
    if (kind === "move") {
      instance.setData({ ...data, x: data.x + dx * stepX, y: data.y + dy * stepY });
    } else {
      instance.setData({ ...data, x: data.x - dx * stepX / 2, y: data.y - dy * stepY / 2, width: data.width + dx * stepX, height: data.height + dy * stepY });
    }
  }

  async function confirm() {
    const instance = cropper.current;
    if (!instance || busy) return;
    setBusy(true);
    setError("");
    try {
      const data = instance.getData(true);
      if (data.width < 64 || data.height < 64) throw new Error("small");
      const canvas = instance.getCroppedCanvas({ maxWidth: 12000, maxHeight: 12000, imageSmoothingEnabled: true, imageSmoothingQuality: "high" });
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.92));
      if (!blob) throw new Error("canvas");
      props.onConfirm(new File([blob], `crop-${props.file.name.replace(/\.[^.]+$/, "")}.webp`, { type: "image/webp", lastModified: Date.now() }), data);
    } catch (cause) {
      setError(cause instanceof Error && cause.message === "small" ? props.smallLabel : props.errorLabel);
      setBusy(false);
    }
  }

  const keyControl = (label: string, kind: "move" | "resize", dx: number, dy: number) => <button type="button" className="crop-nudge-button" aria-label={label} disabled={busy} onClick={() => nudge(kind, dx, dy)}>{label}</button>;

  return <div className="photo-source-overlay crop-overlay" role="presentation">
    <section ref={dialogRef} className="photo-source-dialog crop-dialog" role="dialog" aria-modal="true" aria-label={props.title} onKeyDown={onDialogKeyDown}>
      <div className="dialog-heading"><h3>{props.title}</h3><button type="button" className="icon-button" aria-label={props.cancelLabel} disabled={busy} onClick={props.onCancel}>×</button></div>
      <p className="crop-help">{props.help}</p>
      <Cropper
        src={props.sourceUrl}
        style={{ height: "min(54vh, 470px)", width: "100%" }}
        className="photo-cropper-widget"
        alt={props.sourceAlt}
        viewMode={1}
        dragMode="crop"
        aspectRatio={Number.NaN}
        autoCropArea={0.86}
        guides
        background={false}
        responsive
        restore={false}
        cropBoxMovable
        cropBoxResizable
        movable
        zoomable
        zoomOnWheel
        zoomOnTouch
        rotatable
        toggleDragModeOnDblclick={false}
        wheelZoomRatio={0.08}
        onInitialized={(instance) => { cropper.current = instance; const image = instance.getImageData(); fitRatio.current = image.width / image.naturalWidth; }}
        zoom={(event) => { setZoom(Math.max(0.25, Math.min(4, event.detail.ratio / fitRatio.current))); }}
        preview=".crop-output-preview"
      />
      <div className="crop-controls">
        <label className="crop-aspect"><span>{props.aspectLabel}</span><select value={ratio} disabled={busy} onChange={(event) => updateAspect(event.target.value)}>
          <option value="free">{props.aspectFree}</option><option value="original">{props.aspectOriginal}</option><option value="1:1">1:1</option><option value="4:3">4:3</option><option value="3:2">3:2</option><option value="16:9">16:9</option>
        </select></label>
        <label className="crop-zoom"><span>{props.zoomLabel}</span><input type="range" min="0.25" max="4" step="0.01" value={zoom} disabled={busy} onChange={(event) => { const value = Number(event.target.value); setZoom(value); cropper.current?.zoomTo(fitRatio.current * value); }}/><output>{zoom.toFixed(2)}×</output></label>
        <div className="crop-output-preview-wrap"><span>{props.previewLabel}</span><div className="crop-output-preview" aria-label={props.previewLabel}/></div>
      </div>
      <div className="crop-accessibility-controls" aria-label={`${props.movingLabel} / ${props.resizingLabel}`}>
        <div className="crop-nudge-group"><span>{props.movingLabel}</span>{keyControl(props.moveLeft, "move", -1, 0)}{keyControl(props.moveUp, "move", 0, -1)}{keyControl(props.moveDown, "move", 0, 1)}{keyControl(props.moveRight, "move", 1, 0)}</div>
        <div className="crop-nudge-group"><span>{props.resizingLabel}</span>{keyControl(props.shrinkWidth, "resize", -1, 0)}{keyControl(props.growWidth, "resize", 1, 0)}{keyControl(props.shrinkHeight, "resize", 0, -1)}{keyControl(props.growHeight, "resize", 0, 1)}</div>
      </div>
      {error ? <p className="form-error" role="alert">{error}</p> : null}
      <div className="dialog-actions crop-actions"><button type="button" className="text-button" disabled={busy} onClick={reset}>{props.resetLabel}</button><button type="button" className="text-button" disabled={busy} onClick={() => cropper.current?.rotate(90)}>{props.rotateLabel}</button><button type="button" className="text-button" disabled={busy} onClick={props.onCancel}>{props.cancelLabel}</button><button type="button" className="quiet-button" disabled={busy} onClick={() => void confirm()}>{busy ? props.busyLabel : props.confirmLabel}</button></div>
    </section>
  </div>;
}
