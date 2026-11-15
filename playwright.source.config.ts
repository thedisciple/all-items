import {defineConfig} from '@playwright/test';import ai from './playwright.ai.config';
const server=Array.isArray(ai.webServer)?ai.webServer[0]:ai.webServer;if(!server)throw new Error('Synthetic server required');
export default defineConfig({...ai,projects:[{name:'source-review',testMatch:'m5b_source.spec.ts'}],webServer:{...server,env:{...server.env,ALL_ITEMS_AI_PROVIDER:'',ALL_ITEMS_AI_MODEL:''}}});
