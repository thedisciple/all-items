import {defineConfig} from "@playwright/test";

export default defineConfig({
  testDir:"./e2e",
  testMatch:"p2_proxy.spec.ts",
  workers:1,
  reporter:"list",
  use:{browserName:"chromium",channel:"msedge",headless:true},
});
