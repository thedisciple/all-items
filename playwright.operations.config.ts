import {defineConfig} from '@playwright/test';
import release from './playwright.release.config';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const server=Array.isArray(release.webServer)?release.webServer[0]:release.webServer;
if(!server)throw new Error('Production test server configuration required');
const diagnostics=process.env.ALL_ITEMS_RUNTIME_DIAGNOSTICS;
export default defineConfig({...release,projects:[{name:'operations-security',testMatch:['m4d_operations.spec.ts','m4e_runtime.spec.ts','p1_auth.spec.ts','p2_empty_account.spec.ts','p2_funnel.spec.ts']}],webServer:{...server,cwd:process.env.ALL_ITEMS_E2E_CHECKOUT??process.cwd(),env:{...server.env,ALL_ITEMS_RELEASE_SHA:process.env.ALL_ITEMS_E2E_SHA??'',...(diagnostics?{ALL_ITEMS_RUNTIME_DIAGNOSTICS:diagnostics,NODE_OPTIONS:`--import ${pathToFileURL(path.join(process.cwd(),'e2e/helpers/runtime-monitor.mjs')).href}`}:{})}}});
