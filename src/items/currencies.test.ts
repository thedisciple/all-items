import { describe, expect, it } from "vitest";
import { currencyCodes, currencyDigits, orderedCurrencies, parsePriceMinor, priceDecimal, suggestedCurrency } from "./currencies";

describe("currency amounts", () => {
  it("uses locale only as a suggestion and includes the full supported list", () => {
    expect(["ru", "en", "uk", "sr-Latn", "zh-Hans"].map(locale => suggestedCurrency(locale as Parameters<typeof suggestedCurrency>[0]))).toEqual(["RUB", "USD", "UAH", "RSD", "CNY"]);
    expect(orderedCurrencies("sr-Latn")[0]).toBe("RSD");
    expect(new Set(orderedCurrencies("uk"))).toEqual(new Set(currencyCodes));
    expect(parsePriceMinor("", "")).toBeNull();
  });
  it("converts exact decimals for zero, two and three fraction digits without rounding", () => {
    expect(currencyDigits("HUF")).toBe(2);
    expect(currencyDigits("JPY")).toBe(0);
    expect(currencyDigits("KWD")).toBe(3);
    expect(parsePriceMinor("12,50", "RSD")).toBe(1250);
    expect(parsePriceMinor(".29", "USD")).toBe(29);
    expect(parsePriceMinor("12.500", "HUF")).toBe(1250);
    expect(parsePriceMinor("12", "JPY")).toBe(12);
    expect(parsePriceMinor("12.345", "KWD")).toBe(12345);
    expect(parsePriceMinor("0.001", "KWD")).toBe(1);
    for (const [value, code] of [["0.001", "USD"], ["1.2", "JPY"], ["-1", "EUR"], ["1e3", "USD"], ["NaN", "USD"], ["1", ""], ["1000000000", "USD"]]) expect(() => parsePriceMinor(value, code!)).toThrow();
    expect(priceDecimal(29, "USD")).toBe("0.29");
    expect(priceDecimal(12, "JPY")).toBe("12");
    expect(priceDecimal(12345, "KWD")).toBe("12.345");
    expect(priceDecimal(1234, "JPY", 2)).toBe("12.34");
    expect(parsePriceMinor("12.34", "JPY", 2)).toBe(1234);
  });
});
