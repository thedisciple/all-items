import {describe,it,expect} from "vitest";
import {formatItemInstant,hasMeaningfulUpdate,parseItemInstant} from "./item-dates";
describe("item timestamps",()=>{
  it("treats stored zoned and legacy SQLite timestamps as UTC instants",()=>{
    expect(parseItemInstant("2025-01-02 03:04:05")?.toISOString()).toBe("2025-01-02T03:04:05.000Z");
    expect(parseItemInstant("2025-01-02T05:04:05+02:00")?.toISOString()).toBe("2025-01-02T03:04:05.000Z");
    expect(parseItemInstant("2025-01-02T03:04:05")).toBeNull();expect(parseItemInstant("not a date")).toBeNull();
  });
  it("formats in the requested locale and viewer timezone, independently of the locale",()=>{
    const value="2025-01-02T03:04:05.000Z";
    for(const locale of ["ru","en","uk","sr-Latn","zh-Hans"])expect(formatItemInstant(value,locale,"Asia/Tokyo")).toBe(new Intl.DateTimeFormat(locale,{dateStyle:"medium",timeStyle:"short",timeZone:"Asia/Tokyo"}).format(new Date(value)));
    expect(formatItemInstant(value,"en","Asia/Tokyo")).not.toBe(formatItemInstant(value,"en","America/New_York"));
  });
  it("shows modification only when it is later than creation",()=>{expect(hasMeaningfulUpdate("2025-01-02T03:04:05Z","2025-01-02T03:04:05Z")).toBe(false);expect(hasMeaningfulUpdate("2025-01-02T03:04:05Z","2025-01-02T03:04:06Z")).toBe(true);});
});
