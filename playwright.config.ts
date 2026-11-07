import path from "node:path";
import os from "node:os";
import { randomUUID } from "node:crypto";
import { defineConfig } from "@playwright/test";

const dataDirectory = process.env.ALL_ITEMS_E2E_ROOT??=path.join(os.tmpdir(), `all-items-e2e-${process.pid}-${randomUUID()}`);

export default defineConfig({
  testDir: "./e2e",
  testIgnore: ["m3_2_import.spec.ts","m3_3a_restart.spec.ts"],
  fullyParallel: false,
  workers: 1,
  reporter: [["list"],["json",{outputFile:path.join(dataDirectory,"edge-report.json")}]],
  globalSetup:"./e2e/helpers/auth-setup.ts",
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
    storageState:path.join(dataDirectory,"owner-browser.json"),
  },
  webServer: {
    command: "node --import tsx e2e/helpers/auth-server.ts",
    url: "http://127.0.0.1:3100/login",
    env: { ALL_ITEMS_DATA_DIR: dataDirectory,ALL_ITEMS_ORIGIN:"http://127.0.0.1:3100" },
    reuseExistingServer: false,
    timeout: 120_000,
    stdout: "pipe",
    stderr: "pipe",
  },
});
