import { describe, expect, it } from "vitest";
import { formatCollectionCount, formatDate, formatItemCount, locales, messages, translate } from "./messages";
import { resolveLocale } from "./server";

describe("locale selection and formatting", () => {
  it("keeps an explicit choice ahead of browser preferences", () => {
    expect(resolveLocale("ru", "en-US,en;q=0.9")).toBe("ru");
    expect(resolveLocale("en", "ru-RU,ru;q=0.9")).toBe("en");
    expect(resolveLocale("fr", "en-US,en;q=0.9")).toBe("en");
    expect(resolveLocale(undefined, "sr-Latn,sr;q=0.9")).toBe("sr-Latn");
    expect(resolveLocale(undefined, "sr-Cyrl-RS,sr;q=0.9")).toBe("sr-Latn");
    expect(resolveLocale(undefined, "uk-UA,uk;q=0.9")).toBe("uk");
    expect(resolveLocale(undefined, "zh-CN,zh;q=0.9")).toBe("zh-Hans");
    expect(resolveLocale("uk", "en-US,en;q=0.9")).toBe("uk");
  });

  it("formats counts with Russian plurals and English plurals", () => {
    expect(formatItemCount("ru", 21)).toBe("21 вещь");
    expect(formatItemCount("ru", 24)).toBe("24 вещи");
    expect(formatCollectionCount("en", 1)).toBe("1 collection");
    expect(formatCollectionCount("en", 2)).toBe("2 collections");
    expect(translate("en", "collectionSharedInventory")).toBe("Items also appear in the full inventory.");
    expect(formatItemCount("uk", 22)).toBe("22 предмети");
    expect(formatCollectionCount("sr-Latn", 2)).toBe("2 kolekcije");
    expect(formatItemCount("zh-Hans", 2)).toBe("2 件物品");
    expect(formatDate("zh-Hans", "2026-10-23T12:00:00.000Z")).not.toBe("2026-10-23T12:00:00.000Z");
  });

  it("keeps all five local dictionaries complete and nonempty", () => {
    const keys = Object.keys(messages.ru).sort();
    expect(locales).toEqual(["ru", "en", "uk", "sr-Latn", "zh-Hans"]);
    for (const locale of locales) {
      expect(Object.keys(messages[locale]).sort()).toEqual(keys);
      for (const value of Object.values(messages[locale])) expect(value.trim()).not.toBe("");
      if (locale !== "ru" && locale !== "en") {
        const unchanged = keys.filter((key) => messages[locale][key as keyof typeof messages["ru"]] === messages.en[key as keyof typeof messages["en"]]);
        // The gallery counter contains only parameters and a separator, no words.
        const intentionallyShared = new Set(["galleryCounter", "categoryUnknown", "itemModel", "languageChinese", "languageEnglish", "languageRussian", "languageSerbian", "languageUkrainian", "locationUnknown"]);
        expect(unchanged.every((key) => intentionallyShared.has(key))).toBe(true);
        expect(unchanged.length).toBeLessThanOrEqual(intentionallyShared.size);
      }
    }
    expect(translate("uk", "languageUkrainian")).toBe("Українська");
    expect(translate("sr-Latn", "allItems")).toBe("Sve stvari");
    expect(translate("zh-Hans", "allItems")).toBe("全部物品");
  });
});
