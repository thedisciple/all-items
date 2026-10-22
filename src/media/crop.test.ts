import { describe, expect, it } from "vitest";
import { cropDataSchema } from "./crop-data";

describe("crop editor operation data", () => {
  it("accepts freeform portrait and landscape crop rectangles and rotations", () => {
    expect(cropDataSchema.parse({ x: 12, y: 30, width: 48, height: 120, rotate: 0, scaleX: 1, scaleY: 1 })).toMatchObject({ width: 48, height: 120 });
    expect(cropDataSchema.parse({ x: 10, y: 15, width: 160, height: 90, rotate: 90, scaleX: 1, scaleY: 1 })).toMatchObject({ rotate: 90, width: 160, height: 90 });
  });

  it("rejects non-finite, non-positive, out-of-range, and unexpected crop fields", () => {
    expect(cropDataSchema.safeParse({ x: 0, y: 0, width: 0, height: 20, rotate: 0, scaleX: 1, scaleY: 1 }).success).toBe(false);
    expect(cropDataSchema.safeParse({ x: Number.NaN, y: 0, width: 20, height: 20, rotate: 0, scaleX: 1, scaleY: 1 }).success).toBe(false);
    expect(cropDataSchema.safeParse({ x: 0, y: 0, width: 20, height: 20, rotate: 0, scaleX: 1, scaleY: 1, path: "../../private" }).success).toBe(false);
  });
});
