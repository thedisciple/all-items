import { defineConfig } from '@playwright/test';
import ai from './playwright.ai.config';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const server=Array.isArray(ai.webServer)?ai.webServer[0]:ai.webServer;
if(!server)throw new Error('Isolated production server required');
const diagnostics=process.env.ALL_ITEMS_RUNTIME_DIAGNOSTICS;
export default defineConfig({ ...ai, projects: [{ name: 'capture-review', testMatch: ['m5c_capture.spec.ts', 'm5a_identification.spec.ts', 'm4a_creation.spec.ts', 'm4a_creation_failures.spec.ts', 'm4a_recovery.spec.ts', 'm4a_retry.spec.ts'] }],webServer:{...server,env:{...server.env,...(diagnostics?{ALL_ITEMS_RUNTIME_DIAGNOSTICS:diagnostics,NODE_OPTIONS:`${server.env?.NODE_OPTIONS??''} --import ${pathToFileURL(path.join(process.cwd(),'e2e/helpers/runtime-monitor.mjs')).href}`}:{})}} });
