import { expect, test as base } from "@playwright/test";

export const test = base.extend<{ browserAudit: void }>({
  browserAudit: [async ({ page }, use) => {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
    await use();
    expect(errors, "No uncaught browser errors or console errors in the M3.4 flow").toEqual([]);
  }, { auto: true }],
});

export { expect };
