import {defineConfig} from '@playwright/test';
import release from './playwright.release.config';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const server=Array.isArray(release.webServer)?release.webServer[0]:release.webServer;
if(!server)throw new Error('Isolated production server required');
export default defineConfig({...release,globalSetup:'./e2e/helpers/ai-setup.ts',projects:[{name:'local-ai',testMatch:'m5a_identification.spec.ts'}],webServer:{...server,env:{...server.env,ALL_ITEMS_AI_PROVIDER:'ollama',ALL_ITEMS_AI_MODEL:'synthetic-vision',NODE_OPTIONS:`--import ${pathToFileURL(path.join(process.cwd(),'e2e/helpers/ai-provider.mjs')).href}`}}});
