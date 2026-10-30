import { expect, test as base } from "@playwright/test";

export const test = base.extend<{ browserAudit: void; expectedResourceErrors: string[] }>({
  expectedResourceErrors: [[], { option: true }],
  browserAudit: [async ({ page, expectedResourceErrors }, use) => {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    page.on("console", message => { if (message.type() === "error" && !expectedResourceErrors.includes(message.text())) errors.push(message.text()); });
    await use();
    expect(errors, "No uncaught application errors or unexpected console errors").toEqual([]);
  }, { auto: true }],
});

export { expect };
