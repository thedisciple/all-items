import path from "node:path";
import os from "node:os";
import { randomUUID } from "node:crypto";
import { defineConfig } from "@playwright/test";

const run = randomUUID();
export default defineConfig({
  testDir: "./e2e",
  testMatch: "m3_2_import.spec.ts",
  workers: 1,
  reporter: "list",
  timeout: 120_000,
  expect: { timeout: 10_000 },
  use: { baseURL: "http://127.0.0.1:3102", browserName: "chromium", channel: "msedge", headless: true, locale: "ru-RU", viewport: { width: 1365, height: 900 }, trace: "retain-on-failure" },
  webServer: [
    { command: "npm start -- --port 3102", url: "http://127.0.0.1:3102", env: { ALL_ITEMS_DATA_DIR: path.join(os.tmpdir(), `all-items-import-source-${run}`) }, reuseExistingServer: false, timeout: 120_000 },
    { command: "npm start -- --port 3103", url: "http://127.0.0.1:3103", env: { ALL_ITEMS_DATA_DIR: path.join(os.tmpdir(), `all-items-import-target-${run}`) }, reuseExistingServer: false, timeout: 120_000 },
  ],
});
