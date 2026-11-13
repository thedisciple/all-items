import {defineConfig} from "@playwright/test";
import release from "./playwright.release.config";
const server=Array.isArray(release.webServer)?release.webServer[0]:release.webServer;
export default defineConfig({...release,projects:[{name:'operations-security',testMatch:['m4d_operations.spec.ts','p1_auth.spec.ts','p2_empty_account.spec.ts','p2_funnel.spec.ts']}],webServer:{...server,cwd:process.env.ALL_ITEMS_E2E_CHECKOUT??process.cwd(),env:{...server?.env,ALL_ITEMS_RELEASE_SHA:process.env.ALL_ITEMS_E2E_SHA??''}}});
