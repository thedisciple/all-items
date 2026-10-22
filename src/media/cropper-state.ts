export type CropperImageMetrics = {
  width: number;
  height: number;
  naturalWidth: number;
  naturalHeight: number;
  rotate: number;
  baseRatio: number;
};

const finitePositive = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value > 0;

export function getCropperImageMetrics(image: Partial<CropperImageMetrics> | null | undefined, rotation = image?.rotate ?? 0): CropperImageMetrics | null {
  if (!image || !finitePositive(image.width) || !finitePositive(image.height)
    || !finitePositive(image.naturalWidth) || !finitePositive(image.naturalHeight)
    || typeof rotation !== "number" || !Number.isFinite(rotation)) return null;

  const baseRatio = image.width / image.naturalWidth;
  if (!finitePositive(baseRatio)) return null;

  return {
    width: image.width,
    height: image.height,
    naturalWidth: image.naturalWidth,
    naturalHeight: image.naturalHeight,
    rotate: rotation,
    baseRatio,
  };
}

export function safeZoomTarget(value: number, baseRatio: number) {
  if (!Number.isFinite(value) || !finitePositive(baseRatio)) return null;
  const zoom = Math.max(0.25, Math.min(4, value));
  const target = baseRatio * zoom;
  return finitePositive(target) ? { zoom, target } : null;
}

export function aspectRatioForPreset(preset: string, image: CropperImageMetrics) {
  if (preset === "free") return Number.NaN;
  if (preset === "original") {
    const quarterTurn = Math.abs(Math.round(image.rotate / 90)) % 2 === 1;
    const ratio = quarterTurn ? image.naturalHeight / image.naturalWidth : image.naturalWidth / image.naturalHeight;
    return finitePositive(ratio) ? ratio : null;
  }
  const [width, height] = preset.split(":").map(Number);
  if (!finitePositive(width) || !finitePositive(height)) return null;
  const ratio = width / height;
  return finitePositive(ratio) ? ratio : null;
}

export function isValidCropCoordinates(data: { x: number; y: number; width: number; height: number; rotate: number; scaleX: number; scaleY: number }) {
  return [data.x, data.y, data.width, data.height, data.rotate, data.scaleX, data.scaleY].every(Number.isFinite)
    && data.x >= -12_000 && data.x <= 12_000 && data.y >= -12_000 && data.y <= 12_000
    && data.width > 0 && data.width <= 12_000 && data.height > 0 && data.height <= 12_000
    && Math.abs(data.rotate) <= 3_600 && Math.abs(data.scaleX) <= 4 && Math.abs(data.scaleY) <= 4;
}
