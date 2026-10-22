import { describe, expect, it } from "vitest";
import { categories, categoryFilterValues, categoryKeyForStoredValue, categoryMessageKey } from "./categories";

describe("stable inventory categories", () => {
  it("provides all proposed stable keys with localized message keys", () => {
    expect(categories).toEqual(["electronics", "computers", "tools", "antiques", "clothing", "plants", "home", "books_hobbies", "sports", "kids", "other"]);
    expect(categories.every((key) => categoryMessageKey(key))).toBe(true);
  });

  it("maps only known legacy labels and preserves custom values", () => {
    expect(categoryKeyForStoredValue("ЭЛЕКТРОНИКА и компоненты")).toBe("electronics");
    expect(categoryKeyForStoredValue("Garden plants")).toBeNull();
    expect(categoryFilterValues("plants")).toContain("Bašta i dvorište");
    expect(categoryFilterValues("My workshop parts")).toEqual(["My workshop parts"]);
  });
});
