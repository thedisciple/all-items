import { describe, expect, it } from "vitest";
import { aspectRatioForPreset, getCropperImageMetrics, isValidCropCoordinates, safeZoomTarget } from "./cropper-state";

const image = { width: 400, height: 300, naturalWidth: 800, naturalHeight: 600, rotate: 0 };

describe("cropper image state", () => {
  it("accepts ready image metrics and rejects incomplete or invalid image dimensions", () => {
    expect(getCropperImageMetrics(image)?.baseRatio).toBe(0.5);
    expect(getCropperImageMetrics(undefined)).toBeNull();
    expect(getCropperImageMetrics({ ...image, naturalWidth: 0 })).toBeNull();
    expect(getCropperImageMetrics({ ...image, width: Number.NaN })).toBeNull();
  });

  it("bounds finite zoom values and rejects an invalid base ratio", () => {
    expect(safeZoomTarget(2, 0.5)).toEqual({ zoom: 2, target: 1 });
    expect(safeZoomTarget(Number.POSITIVE_INFINITY, 0.5)).toBeNull();
    expect(safeZoomTarget(2, 0)).toBeNull();
    expect(safeZoomTarget(8, 0.5)?.zoom).toBe(4);
  });

  it("maps all aspect presets and swaps the original ratio after a quarter turn", () => {
    const metrics = getCropperImageMetrics(image)!;
    expect(Number.isNaN(aspectRatioForPreset("free", metrics))).toBe(true);
    expect(aspectRatioForPreset("original", metrics)).toBeCloseTo(4 / 3);
    expect(aspectRatioForPreset("1:1", metrics)).toBe(1);
    expect(aspectRatioForPreset("4:3", metrics)).toBeCloseTo(4 / 3);
    expect(aspectRatioForPreset("3:2", metrics)).toBeCloseTo(3 / 2);
    expect(aspectRatioForPreset("16:9", metrics)).toBeCloseTo(16 / 9);
    expect(aspectRatioForPreset("original", { ...metrics, rotate: 90 })).toBeCloseTo(3 / 4);
    expect(aspectRatioForPreset("unknown", metrics)).toBeNull();
  });

  it("rejects non-finite, empty, and out-of-bounds crop coordinates", () => {
    const valid = { x: 12, y: 14, width: 200, height: 100, rotate: 0, scaleX: 1, scaleY: 1 };
    expect(isValidCropCoordinates(valid)).toBe(true);
    expect(isValidCropCoordinates({ ...valid, x: Number.NaN })).toBe(false);
    expect(isValidCropCoordinates({ ...valid, width: 0 })).toBe(false);
    expect(isValidCropCoordinates({ ...valid, y: 12_001 })).toBe(false);
  });
});
