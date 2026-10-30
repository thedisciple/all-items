import { expect, type Locator, type Page } from "@playwright/test";

// Use actual rendered geometry, independently of OS/font rasterization.
export async function expectPageFits(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
}
export async function expectControlsFit(region: Locator) {
  const outside = await region.evaluate(element => {
    const r = element.getBoundingClientRect();
    return [...element.querySelectorAll<HTMLElement>("input:not([type=hidden]),select,button")].filter(control => control.getClientRects().length).filter(control => { const b=control.getBoundingClientRect(); return b.left < r.left-1 || b.right > r.right+1; }).map(control => control.tagName);
  });
  expect(outside).toEqual([]);
}
export async function expectFooterInset(dialog: Locator, minimum: number) {
  const geometry=await dialog.evaluate(element => {
    const d=element.getBoundingClientRect(),footer=element.querySelector<HTMLElement>(".dialog-actions")!;
    const buttons=[...footer.querySelectorAll("button")].filter(button=>button.getClientRects().length).map(button=>button.getBoundingClientRect());
    return {bottom:d.bottom-Math.max(...buttons.map(b=>b.bottom)),left:Math.min(...buttons.map(b=>b.left))-d.left,right:d.right-Math.max(...buttons.map(b=>b.right)),visible:buttons.every(b=>b.top>=d.top&&b.bottom<=d.bottom&&b.bottom<=innerHeight)};
  });
  expect(geometry.visible).toBe(true);expect(geometry.bottom).toBeGreaterThanOrEqual(minimum);expect(geometry.left).toBeGreaterThanOrEqual(minimum);expect(geometry.right).toBeGreaterThanOrEqual(minimum);
}
