import { expect,it } from "vitest";
import { normalizedInventoryName,suggestInventoryName } from "./inventory-names";

it("compares trimmed Unicode names and suggests a bounded unused suffix",()=>{
  expect(normalizedInventoryName("  МАСТЕРСКАЯ  ")).toBe(normalizedInventoryName("мастерская"));
  expect(suggestInventoryName(" Мастерская ",["мастерская","МАСТЕРСКАЯ (2)"])).toBe("Мастерская (3)");
  expect(suggestInventoryName("Workshop",["Home"])).toBe("Workshop");
  const long="😀".repeat(60);
  const result=suggestInventoryName(long,[long]);
  expect(result.length).toBeLessThanOrEqual(120);
  expect(result.endsWith(" (2)")).toBe(true);
  expect(result).not.toMatch(/[\uD800-\uDBFF] \(/);
});
