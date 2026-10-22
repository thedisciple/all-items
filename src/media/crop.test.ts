import { describe, expect, it } from "vitest";
import { cropFromDrag, moveCropRect, zoomCropRect } from "./crop";

describe("photo crop geometry", () => {
  it("creates a freeform rectangle without imposing an aspect ratio", () => {
    expect(cropFromDrag({ x: 80, y: 100 }, { x: 20, y: 10 }, 120, 160)).toEqual({ x: 20, y: 10, width: 60, height: 90 });
  });

  it("keeps the crop inside the source while it moves", () => {
    const crop = { x: 15, y: 20, width: 50, height: 40 };
    expect(moveCropRect(crop, -30, -30, 100, 80)).toEqual({ ...crop, x: 0, y: 0 });
    expect(moveCropRect(crop, 80, 80, 100, 80)).toEqual({ ...crop, x: 50, y: 40 });
  });

  it("zooms around the crop center and preserves its proportions", () => {
    const crop = { x: 20, y: 10, width: 40, height: 20 };
    const zoomed = zoomCropRect(crop, 2, 100, 80);
    expect(zoomed).toEqual({ x: 30, y: 15, width: 20, height: 10 });
    expect(zoomCropRect(zoomed, 0.25, 100, 80)).toEqual({ x: 0, y: 0, width: 80, height: 40 });
  });
});
