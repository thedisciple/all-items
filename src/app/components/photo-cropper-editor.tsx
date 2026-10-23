"use client";

import Cropper from "react-cropper";
import type CropperJS from "cropperjs";
import { RotateCcw, RotateCw, Undo2, X } from "lucide-react";
import { Component, useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { aspectRatioForPreset, getCropperImageMetrics, isValidCropCoordinates, safeZoomTarget } from "@/media/cropper-state";
import { useI18n } from "@/i18n/provider";

type Props = {
  file: File; sourceUrl: string; onConfirm: (file: File, crop: CropperJS.Data) => void; onCancel: () => void; onUseOriginal: () => void;
  cancelLabel: string; sourceAlt: string; title: string; confirmLabel: string; resetLabel: string; originalLabel: string;
  zoomLabel: string; aspectLabel: string; aspectFree: string; aspectOriginal: string; rotateLabel: string; rotateCounterclockwiseLabel: string;
  errorLabel: string; smallLabel: string; busyLabel: string; keyboardLabel: string; unavailableLabel: string;
  moveLeft: string; moveRight: string; moveUp: string; moveDown: string;
  moveCropLabel: string; resizeCropLabel: string; shrinkWidth: string; growWidth: string; shrinkHeight: string; growHeight: string;
};

type BoundaryProps = { children: ReactNode; onCancel: () => void; onUseOriginal: () => void; unavailableLabel: string; cancelLabel: string; originalLabel: string };
type BoundaryState = { failed: boolean };

class CropperErrorBoundary extends Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { failed: false };

  static getDerivedStateFromError(): BoundaryState { return { failed: true }; }

  componentDidCatch(error: Error) { console.error("Photo cropper could not initialize", error); }

  render() {
    if (!this.state.failed) return this.props.children;
    return <section className="photo-source-dialog crop-dialog" role="dialog" aria-modal="true" aria-label={this.props.unavailableLabel}>
      <div className="dialog-heading"><h3>{this.props.unavailableLabel}</h3><button type="button" className="icon-button" aria-label={this.props.cancelLabel} onClick={this.props.onCancel}>×</button></div>
      <div className="dialog-actions"><button type="button" className="quiet-button" onClick={this.props.onUseOriginal}>{this.props.originalLabel}</button><button type="button" className="text-button" onClick={this.props.onCancel}>{this.props.cancelLabel}</button></div>
    </section>;
  }
}

const readyTimeoutMs = 12_000;

export default function PhotoCropperEditor(props: Props) {
  const { locale } = useI18n();
  const cropper = useRef<CropperJS | null>(null);
  const alive = useRef(true);
  const readyRef = useRef(false);
  const fitRatio = useRef(0);
  const [isReady, setIsReady] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [ratio, setRatio] = useState("free");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const dialogRef = useRef<HTMLElement>(null);

  useEffect(() => {
    alive.current = true;
    const timeout = window.setTimeout(() => { if (!readyRef.current) setError(props.unavailableLabel); }, readyTimeoutMs);
    dialogRef.current?.querySelector<HTMLElement>("button:not([disabled])")?.focus();
    return () => {
      alive.current = false;
      readyRef.current = false;
      cropper.current = null;
      window.clearTimeout(timeout);
    };
  }, [props.unavailableLabel]);

  function getReadyCropper() {
    return alive.current && readyRef.current ? cropper.current : null;
  }

  function getImageMetrics(instance: CropperJS) {
    const imageData = instance.getImageData();
    const cropData = instance.getData();
    return getCropperImageMetrics(imageData, cropData.rotate ?? imageData.rotate ?? 0);
  }

  function fitSource(instance: CropperJS) {
    const canvas = instance.getCanvasData();
    const container = instance.getContainerData();
    if (![canvas.naturalWidth, canvas.naturalHeight, container.width, container.height].every(Number.isFinite)
      || canvas.naturalWidth <= 0 || canvas.naturalHeight <= 0 || container.width <= 0 || container.height <= 0) return null;
    const target = Math.min(container.width / canvas.naturalWidth, container.height / canvas.naturalHeight);
    if (!Number.isFinite(target) || target <= 0) return null;
    const width = canvas.naturalWidth * target;
    const height = canvas.naturalHeight * target;
    instance.setCanvasData({ left: (container.width - width) / 2, top: (container.height - height) / 2, width });
    fitRatio.current = target;
    setZoom(1);
    const fitted = instance.getCanvasData();
    return fitted;
  }

  function onReady(event: CropperJS.ReadyEvent) {
    if (!alive.current) return;
    try {
      const instance = event.currentTarget?.cropper ?? cropper.current;
      const metrics = instance ? getImageMetrics(instance) : null;
      if (!instance || !metrics) { readyRef.current = false; setError(props.unavailableLabel); return; }
      cropper.current = instance;
      fitRatio.current = metrics.baseRatio;
      readyRef.current = true;
      setIsReady(true);
      setError("");
      if (instance.getImageData().width <= 0 || instance.getImageData().height <= 0) {
        readyRef.current = false;
        setIsReady(false);
        setError(props.unavailableLabel);
      }
    } catch {
      readyRef.current = false;
      setIsReady(false);
      setError(props.unavailableLabel);
    }
  }

  function onCropperError() {
    if (!alive.current) return;
    readyRef.current = false;
    setIsReady(false);
    setError(props.unavailableLabel);
  }

  function onZoom(event: CropperJS.ZoomEvent) {
    const target = safeZoomTarget(event.detail.ratio / fitRatio.current, fitRatio.current);
    if (!target || !readyRef.current || !alive.current) { event.preventDefault(); return; }
    setZoom((current) => Math.abs(current - target.zoom) < 0.005 ? current : target.zoom);
  }

  function updateZoom(value: number) {
    const instance = getReadyCropper();
    const target = safeZoomTarget(value, fitRatio.current);
    if (!instance || !target) return;
    try { instance.zoomTo(target.target); }
    catch { setError(props.errorLabel); }
  }

  function updateAspect(next: string) {
    const instance = getReadyCropper();
    if (!instance) return;
    try {
      if (next === "original") {
        const rotation = instance.getData().rotate;
        instance.clear();
        instance.reset();
        if (Number.isFinite(rotation) && rotation !== 0) instance.rotateTo(rotation);
      }
      const metrics = getImageMetrics(instance);
      const canvas = next === "original" ? fitSource(instance) : null;
      const aspect = next === "original" && canvas ? canvas.width / canvas.height : metrics && aspectRatioForPreset(next, metrics);
      if (aspect === null || aspect === undefined) { setError(props.errorLabel); return; }
      instance.setAspectRatio(aspect);
      if (next === "original" && canvas && [canvas.left, canvas.top, canvas.width, canvas.height, aspect].every(Number.isFinite) && canvas.width > 0 && canvas.height > 0) {
        instance.crop();
        instance.setCropBoxData({ left: canvas.left, top: canvas.top, width: canvas.width, height: canvas.height });
      }
      setRatio(next);
      setError("");
    } catch { setError(props.errorLabel); }
  }

  function rotate(direction: 1 | -1) {
    const instance = getReadyCropper();
    if (!instance) return;
    try {
      if (ratio === "original") {
        const rotation = instance.getData().rotate + 90 * direction;
        instance.clear();
        instance.rotateTo(rotation);
        const canvas = fitSource(instance);
        if (!canvas) { setError(props.errorLabel); return; }
        const aspect = canvas.width / canvas.height;
        if (Number.isFinite(aspect) && aspect > 0) {
          instance.setAspectRatio(aspect);
          instance.crop();
          instance.setCropBoxData({ left: canvas.left, top: canvas.top, width: canvas.width, height: canvas.height });
        }
      } else instance.rotate(90 * direction);
      setError("");
    } catch { setError(props.errorLabel); }
  }

  function reset() {
    const instance = getReadyCropper();
    if (!instance) return;
    try {
      instance.reset();
      instance.setAspectRatio(Number.NaN);
      setZoom(1);
      setRatio("free");
      setError("");
    } catch { setError(props.errorLabel); }
  }

  function adjustCrop(kind: "move" | "resize", dx: number, dy: number) {
    const instance = getReadyCropper();
    if (!instance) return;
    try {
      const data = instance.getData();
      if (!isValidCropCoordinates(data)) { setError(props.errorLabel); return; }
      const stepX = Math.max(1, data.width * 0.04);
      const stepY = Math.max(1, data.height * 0.04);
      instance.setData(kind === "move"
        ? { ...data, x: data.x + dx * stepX, y: data.y + dy * stepY }
        : { ...data, x: data.x - dx * stepX / 2, y: data.y - dy * stepY / 2, width: data.width + dx * stepX, height: data.height + dy * stepY });
      setError("");
    } catch { setError(props.errorLabel); }
  }

  async function confirm() {
    const instance = getReadyCropper();
    if (!instance || busy) return;
    setBusy(true);
    setError("");
    try {
      const data = instance.getData(true);
      if (!isValidCropCoordinates(data) || data.width < 64 || data.height < 64) throw new Error("invalid-crop");
      const canvas = instance.getCroppedCanvas({ maxWidth: 12_000, maxHeight: 12_000, imageSmoothingEnabled: true, imageSmoothingQuality: "high" });
      if (!canvas || !Number.isFinite(canvas.width) || !Number.isFinite(canvas.height) || canvas.width < 1 || canvas.height < 1) throw new Error("invalid-canvas");
      const blob = await new Promise<Blob | null>((resolve, reject) => {
        const timeout = window.setTimeout(() => reject(new Error("canvas-timeout")), 20_000);
        try { canvas.toBlob((result) => { window.clearTimeout(timeout); resolve(result); }, "image/webp", 0.92); }
        catch (cause) { window.clearTimeout(timeout); reject(cause); }
      });
      if (!blob || blob.size < 1 || !["image/webp", "image/png"].includes(blob.type)) throw new Error("invalid-blob");
      const extension = blob.type === "image/png" ? "png" : "webp";
      const stem = props.file.name.replace(/\.[^.]+$/, "") || "photo";
      const file = new File([blob], `crop-${stem}.${extension}`, { type: blob.type, lastModified: Date.now() });
      if (!file.size || file.size > 10 * 1024 * 1024 || !["image/webp", "image/png"].includes(file.type)) throw new Error("invalid-file");
      if (alive.current) props.onConfirm(file, data);
    } catch (cause) {
      setError(cause instanceof Error && cause.message === "invalid-crop" ? props.smallLabel : props.errorLabel);
      if (alive.current) setBusy(false);
    }
  }

  function onDialogKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === "Escape") { props.onCancel(); return; }
    if (event.key !== "Tab") return;
    const focusable = Array.from(event.currentTarget.querySelectorAll<HTMLElement>("button:not([disabled]),input:not([disabled]),select:not([disabled]),summary"));
    const first = focusable[0]; const last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }

  const instanceReady = isReady && !error;
  return <div className="photo-source-overlay crop-overlay" role="presentation">
    <CropperErrorBoundary onCancel={props.onCancel} onUseOriginal={props.onUseOriginal} unavailableLabel={props.unavailableLabel} cancelLabel={props.cancelLabel} originalLabel={props.originalLabel}>
      <section ref={dialogRef} className="photo-source-dialog crop-dialog" role="dialog" aria-modal="true" aria-labelledby="crop-dialog-title" onKeyDown={onDialogKeyDown}>
        <div className="dialog-heading"><h3 id="crop-dialog-title">{props.title}</h3><button type="button" className="icon-button crop-close-button" aria-label={props.cancelLabel} title={props.cancelLabel} onClick={props.onCancel}><X size={18} aria-hidden="true"/></button></div>
        <div className="crop-editor-body"><Cropper
          src={props.sourceUrl}
          style={{ height: "min(54vh, 470px)", width: "100%" }}
          className="photo-cropper-widget"
          alt={props.sourceAlt}
          viewMode={1}
          dragMode="move"
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
          onInitialized={(instance) => { cropper.current = instance; }}
          ready={onReady}
          onError={onCropperError}
          zoom={onZoom}
        />
        {!isReady && !error ? <p className="crop-load-status" role="status">{props.busyLabel}</p> : null}
        <div className="crop-controls">
          <label className="crop-aspect"><span>{props.aspectLabel}</span><select value={ratio} disabled={!instanceReady || busy} onChange={(event) => updateAspect(event.target.value)}>
            <option value="free">{props.aspectFree}</option><option value="original">{props.aspectOriginal}</option><option value="1:1">1:1</option><option value="4:3">4:3</option><option value="3:2">3:2</option><option value="16:9">16:9</option>
          </select></label>
          <label className="crop-zoom"><span>{props.zoomLabel}</span><input aria-label={props.zoomLabel} type="range" min="0.25" max="4" step="0.01" value={zoom} disabled={!instanceReady || busy} onChange={(event) => { const value = Number(event.target.value); const target = safeZoomTarget(value, fitRatio.current); if (target) { setZoom(target.zoom); updateZoom(target.zoom); } }}/><output>× {new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(zoom)}</output></label>
        </div>
        <details className="crop-accessibility-controls" aria-label={props.keyboardLabel}>
          <summary>{props.keyboardLabel}</summary>
          <div className="crop-accessibility-groups">
            <div className="crop-nudge-group"><span>{props.moveCropLabel}</span>
              <button type="button" className="crop-nudge-button" aria-label={props.moveLeft} title={props.moveLeft} disabled={!instanceReady || busy} onClick={() => adjustCrop("move", -1, 0)}>←</button>
              <button type="button" className="crop-nudge-button" aria-label={props.moveUp} title={props.moveUp} disabled={!instanceReady || busy} onClick={() => adjustCrop("move", 0, -1)}>↑</button>
              <button type="button" className="crop-nudge-button" aria-label={props.moveDown} title={props.moveDown} disabled={!instanceReady || busy} onClick={() => adjustCrop("move", 0, 1)}>↓</button>
              <button type="button" className="crop-nudge-button" aria-label={props.moveRight} title={props.moveRight} disabled={!instanceReady || busy} onClick={() => adjustCrop("move", 1, 0)}>→</button>
            </div>
            <div className="crop-nudge-group"><span>{props.resizeCropLabel}</span>
              <button type="button" className="crop-nudge-button" aria-label={props.shrinkWidth} title={props.shrinkWidth} disabled={!instanceReady || busy} onClick={() => adjustCrop("resize", -1, 0)}>−↔</button>
              <button type="button" className="crop-nudge-button" aria-label={props.growWidth} title={props.growWidth} disabled={!instanceReady || busy} onClick={() => adjustCrop("resize", 1, 0)}>↔+</button>
              <button type="button" className="crop-nudge-button" aria-label={props.shrinkHeight} title={props.shrinkHeight} disabled={!instanceReady || busy} onClick={() => adjustCrop("resize", 0, -1)}>−↕</button>
              <button type="button" className="crop-nudge-button" aria-label={props.growHeight} title={props.growHeight} disabled={!instanceReady || busy} onClick={() => adjustCrop("resize", 0, 1)}>↕+</button>
            </div>
          </div>
        </details>
        {error ? <div className="crop-recovery" role="alert"><p>{error}</p><button type="button" className="text-button" disabled={busy} onClick={props.onUseOriginal}>{props.originalLabel}</button></div> : null}
        <div className="crop-toolbar" aria-label={props.title}>
          <div className="crop-tool-group" aria-label={props.rotateLabel}>
            <button type="button" className="icon-button crop-tool-button" aria-label={props.rotateLabel} data-tooltip={props.rotateLabel} disabled={!instanceReady || busy} onClick={() => rotate(1)}><RotateCw size={17} aria-hidden="true"/></button>
            <button type="button" className="icon-button crop-tool-button" aria-label={props.rotateCounterclockwiseLabel} data-tooltip={props.rotateCounterclockwiseLabel} disabled={!instanceReady || busy} onClick={() => rotate(-1)}><RotateCcw size={17} aria-hidden="true"/></button>
          </div>
          <button type="button" className="icon-button crop-tool-button crop-reset-button" aria-label={props.resetLabel} data-tooltip={props.resetLabel} disabled={!instanceReady || busy} onClick={reset}><Undo2 size={17} aria-hidden="true"/></button>
        </div>
        </div>
        <div className="dialog-actions crop-actions">
          <button type="button" className="text-button" onClick={props.onCancel}>{props.cancelLabel}</button>
          <button type="button" className="add-button" disabled={!instanceReady || busy} onClick={() => void confirm()}>{busy ? props.busyLabel : props.confirmLabel}</button>
        </div>
      </section>
    </CropperErrorBoundary>
  </div>;
}
