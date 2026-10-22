export type CropRect = { x: number; y: number; width: number; height: number };

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function cropFromDrag(start: { x: number; y: number }, end: { x: number; y: number }, imageWidth: number, imageHeight: number): CropRect {
  const x = clamp(Math.min(start.x, end.x), 0, imageWidth);
  const y = clamp(Math.min(start.y, end.y), 0, imageHeight);
  const right = clamp(Math.max(start.x, end.x), x, imageWidth);
  const bottom = clamp(Math.max(start.y, end.y), y, imageHeight);
  return { x, y, width: Math.max(1, right - x), height: Math.max(1, bottom - y) };
}

export function moveCropRect(rect: CropRect, dx: number, dy: number, imageWidth: number, imageHeight: number): CropRect {
  return {
    ...rect,
    x: clamp(rect.x + dx, 0, Math.max(0, imageWidth - rect.width)),
    y: clamp(rect.y + dy, 0, Math.max(0, imageHeight - rect.height)),
  };
}

export function zoomCropRect(rect: CropRect, factor: number, imageWidth: number, imageHeight: number): CropRect {
  const scale = 1 / Math.max(0.25, factor);
  const maxScale = Math.min(imageWidth / rect.width, imageHeight / rect.height);
  const safeScale = Math.min(scale, maxScale);
  const width = rect.width * safeScale;
  const height = rect.height * safeScale;
  return {
    x: clamp(rect.x + (rect.width - width) / 2, 0, imageWidth - width),
    y: clamp(rect.y + (rect.height - height) / 2, 0, imageHeight - height),
    width,
    height,
  };
}
