import { expect, test, type Page } from "@playwright/test";
import sharp from "sharp";

async function createPhotoItem(page: Page, name: string) {
  await page.goto("/");
  await page.locator(".add-dialog-trigger").click();
  const dialog = page.getByRole("dialog", { name: "Добавить вещь" });
  await dialog.getByRole("button", { name: "Добавить фото" }).click();
  await page.locator('input[name="photo"]').setInputFiles({ name: "synthetic.png", mimeType: "image/png", buffer: await sharp({ create: { width: 320, height: 240, channels: 3, background: "#567456" } }).png().toBuffer() });
  await page.getByRole("dialog", { name: "Редактировать фото" }).getByRole("button", { name: "Готово" }).click();
  await dialog.getByLabel("Название").fill(name);
  await dialog.getByRole("button", { name: "Добавить вещь" }).click();
  await expect(page).toHaveURL(/added=/);
  return page.getByRole("link", { name: new RegExp(name) });
}

test("private media keeps geometry and alt semantics through HTTP failure and one reconnect retry", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  const row = await createPhotoItem(page, "R1 media failure");
  const image = row.locator("img");
  await expect.poll(() => image.evaluate(el => (el as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  await expect(image).toHaveAttribute("alt", "");
  const before = await row.boundingBox();
  const url = await image.getAttribute("src");
  const failed = page.waitForResponse(response => response.url().includes(url!) && response.status() === 503);
  await page.route("**/media/**?variant=thumbnail", route => route.fulfill({ status: 503, body: "" }));
  await page.reload();
  await failed;
  await expect(row.locator(".private-image-frame")).toHaveAttribute("data-image-state", "error");
  await expect(image).toBeHidden();
  const after = await row.boundingBox();
  expect(after!.height).toBe(before!.height);
  expect(after!.width).toBe(before!.width);
  await page.unroute("**/media/**?variant=thumbnail");
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect(row.locator(".private-image-frame")).toHaveAttribute("data-image-state", "loaded");
  await row.click();
  await expect(page.locator("img.detail-photo")).toHaveAttribute("alt", /R1 media failure/);
  const detail = page.locator(".media-detail");
  await expect(detail).toHaveAttribute("data-image-state", "loaded");
  expect(errors).toEqual([]);
});

test("delayed and interrupted thumbnails remain clickable during navigation and recover on reload", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await createPhotoItem(page, "R1 delayed media");
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/media/**?variant=thumbnail", async route => { await gate; await route.continue().catch(() => {}); });
  await page.reload({ waitUntil: "domcontentloaded" });
  const row = page.getByRole("link", { name: /R1 delayed media/ });
  await expect(row.locator(".private-image-frame")).toHaveAttribute("data-image-state", "loading");
  await row.click();
  await expect(page).toHaveURL(/\/items\//);
  release();
  await page.unroute("**/media/**?variant=thumbnail");
  await page.route("**/media/**?variant=thumbnail", route => route.abort("internetdisconnected"));
  await page.goto("/");
  await expect(row.locator(".private-image-frame")).toHaveAttribute("data-image-state", "error");
  await row.click();
  await expect(page).toHaveURL(/\/items\//);
  await page.unroute("**/media/**?variant=thumbnail");
  await page.goto("/");
  await expect(row.locator(".private-image-frame")).toHaveAttribute("data-image-state", "loaded");
  expect(errors).toEqual([]);
});
