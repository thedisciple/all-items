import {defineConfig} from "@playwright/test";
import base from "./playwright.config";
const server=Array.isArray(base.webServer)?base.webServer[0]:base.webServer;

// One bounded integration gate against the completed production build.
export default defineConfig({...base,
  projects:[
    {name:"release",testMatch:["p1_auth.spec.ts","p2_empty_account.spec.ts","p2_funnel.spec.ts","m3_1_i18n.spec.ts","m3_3a_localization.spec.ts","m4b3_view.spec.ts","m4b_backups.spec.ts"]},
    {name:"draft-language",testMatch:"m3_4_ui.spec.ts",grep:/manual currency/},
  ],
  webServer:{...server,
    command:"node --import tsx e2e/helpers/auth-server.ts",
    url:"http://127.0.0.1:3100/login",
    env:{...server?.env,ALL_ITEMS_E2E_SERVER:"production",ALL_ITEMS_NEXT_DIST:".next",ALL_ITEMS_PROXY_MODE:"",ALL_ITEMS_PROXY_SECRET:"",ALL_ITEMS_TELEGRAM_CLIENT_ID:"",ALL_ITEMS_TELEGRAM_CLIENT_SECRET:""},
    stdout:"ignore",stderr:"pipe",reuseExistingServer:false,timeout:120_000,
  },
});
