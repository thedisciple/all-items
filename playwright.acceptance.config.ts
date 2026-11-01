import {defineConfig} from "@playwright/test";
import base from "./playwright.config";
import os from "node:os";
import path from "node:path";
import {randomUUID} from "node:crypto";

// Run the same synthetic acceptance suite against a completed production build.
export default defineConfig({...base,
  webServer:{
    command:"npm start -- --port 3100",url:"http://127.0.0.1:3100",
    env:{ALL_ITEMS_DATA_DIR:path.join(os.tmpdir(),"all-items-acceptance-"+randomUUID())},
    reuseExistingServer:false,timeout:120_000,stdout:"ignore",stderr:"pipe",
  },
});
