import {defineConfig} from "@playwright/test";
import release from "./playwright.release.config";
export default defineConfig({...release,projects:[
  {name:"m4c-release",testMatch:["m4c_mobile.spec.ts","m4c_pagination.spec.ts","p1_auth.spec.ts","p2_empty_account.spec.ts","p2_funnel.spec.ts","m3_1_i18n.spec.ts","m4b3_view.spec.ts","m4a_creation.spec.ts","m4a_retry.spec.ts","m4a_recovery.spec.ts"]},
  {name:"currency",testMatch:"m3_4_ui.spec.ts",grep:/manual currency/},
  {name:"crop-security",testMatch:"m2d-r1.spec.ts",grep:/cropper|camera|crop/},
]});
