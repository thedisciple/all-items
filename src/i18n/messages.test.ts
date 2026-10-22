import { describe, expect, it } from "vitest";
import { formatCollectionCount, formatItemCount, translate } from "./messages";
import { resolveLocale } from "./server";

describe("locale selection and formatting", () => {
  it("keeps an explicit choice ahead of browser preferences", () => {
    expect(resolveLocale("ru", "en-US,en;q=0.9")).toBe("ru");
    expect(resolveLocale("en", "ru-RU,ru;q=0.9")).toBe("en");
    expect(resolveLocale("fr", "en-US,en;q=0.9")).toBe("en");
    expect(resolveLocale(undefined, "sr-Latn,sr;q=0.9")).toBe("ru");
  });

  it("formats counts with Russian plurals and English plurals", () => {
    expect(formatItemCount("ru", 21)).toBe("21 вещь");
    expect(formatItemCount("ru", 24)).toBe("24 вещи");
    expect(formatCollectionCount("en", 1)).toBe("1 collection");
    expect(formatCollectionCount("en", 2)).toBe("2 collections");
    expect(translate("en", "collectionSharedInventory")).toBe("Items also appear in the full inventory.");
  });
});
