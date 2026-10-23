import path from "node:path";
import os from "node:os";
import { randomUUID } from "node:crypto";
import { defineConfig } from "@playwright/test";

const dataDirectory = path.join(os.tmpdir(), `all-items-m2d-r1-${process.pid}-${randomUUID()}`);

export default defineConfig({
  testDir: "./e2e",
  testIgnore: "m3_2_import.spec.ts",
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  timeout: 45_000,
  expect: { timeout: 8_000 },
  use: {
    baseURL: "http://127.0.0.1:3100",
    browserName: "chromium",
    channel: "msedge",
    headless: true,
    locale: "ru-RU",
    viewport: { width: 1365, height: 900 },
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run dev -- --port 3100",
    url: "http://127.0.0.1:3100",
    env: { ALL_ITEMS_DATA_DIR: dataDirectory },
    reuseExistingServer: false,
    timeout: 120_000,
    stdout: "pipe",
    stderr: "pipe",
  },
});
