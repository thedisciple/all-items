import {parseArgs} from "node:util";
import {readFile} from "node:fs/promises";
import {z} from "zod";
import {chromium} from "@playwright/test";
import {revision} from "../src/operations/environment";

async function main(){
  const {values}=parseArgs({options:{origin:{type:'string'},sha:{type:'string'},credentials:{type:'string'}}});const origin=new URL(z.string().parse(values.origin));if(origin.protocol!=='https:'||!origin.hostname.endsWith('.ts.net'))throw new Error('Exact beta HTTPS origin required');
  const sha=revision.parse(values.sha),schema=z.object({users:z.array(z.object({username:z.string().min(3).max(64),password:z.string().min(12).max(256),inventory:z.string().uuid(),item:z.string().uuid(),media:z.string().uuid()}).strict()).length(2)}).strict();
  const fixture=schema.parse(JSON.parse(await readFile(z.string().parse(values.credentials),'utf8')));if(fixture.users[0].username===fixture.users[1].username||fixture.users[0].inventory===fixture.users[1].inventory)throw new Error('Two independent synthetic users required');
  const health=await fetch(new URL('/api/health',origin),{signal:AbortSignal.timeout(15000)});if(!health.ok||(await health.json()).revision!==sha)throw new Error('External HTTPS revision mismatch');
  const browser=await chromium.launch({channel:'msedge'});
  try{for(const [index,user]of fixture.users.entries()){
    const context=await browser.newContext();try{
      const page=await context.newPage();page.setDefaultTimeout(15000);await page.goto(new URL('/login',origin).href);await page.locator('input[name="username"]').fill(user.username);await page.locator('input[name="password"]').fill(user.password);await page.locator('button[type="submit"]').click();await page.waitForURL(url=>url.pathname!=='/login');
      const own=`/inventories/${user.inventory}`,other=fixture.users[1-index],foreign=`/inventories/${other.inventory}`;
      for(const route of[own,`${own}/items/${user.item}`,`${own}/media/${user.item}/${user.media}?variant=thumbnail`,`${own}/api/export/archive`]){const response=await context.request.get(new URL(route,origin).href);if(response.status()!==200)throw new Error('Synthetic own resource check failed');}
      for(const route of[foreign,`${foreign}/items/${other.item}`,`${foreign}/media/${other.item}/${other.media}?variant=image`,`${foreign}/api/export/archive`]){if((await context.request.get(new URL(route,origin).href)).status()!==404)throw new Error('Cross-user resource check failed');}
    }finally{await context.close();}
  }}finally{await browser.close();}
  console.log('HTTPS, revision, two sessions, inventory/media/archive ownership: verified with synthetic accounts. Physical-device/Telegram acceptance remains separate.');
}
main().catch(()=>{console.error('Synthetic beta acceptance failed; private credentials and resource identifiers withheld.');process.exitCode=1;});
