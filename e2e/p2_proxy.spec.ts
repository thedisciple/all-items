import {test,expect} from "@playwright/test";
import {randomBytes} from "node:crypto";
import {spawn,execFile} from "node:child_process";
import {promisify} from "node:util";
import {mkdtemp,readFile} from "node:fs/promises";
import {createServer as createHttpServer,request as httpRequest} from "node:http";
import {createServer as createHttpsServer,request as httpsRequest} from "node:https";
import os from "node:os";
import path from "node:path";
import {syntheticAccounts} from "./helpers/auth-credentials";

test("isolated HTTPS proxy preserves login and rejects direct or forged requests",async({browser})=>{
  test.setTimeout(180_000);
  const directory=await mkdtemp(path.join(os.tmpdir(),"all-items-p2-proxy-"));
  await promisify(execFile)(process.execPath,["--import","tsx","e2e/helpers/p2-proxy-seed.ts"],{cwd:process.cwd(),env:{...process.env,ALL_ITEMS_DATA_DIR:directory}});
  const openssl=process.platform==="win32"?"C:\\Program Files\\Git\\usr\\bin\\openssl.exe":"openssl";
  const key=path.join(directory,"test-key.pem"),cert=path.join(directory,"test-cert.pem");
  await promisify(execFile)(openssl,["req","-x509","-newkey","rsa:2048","-nodes","-keyout",key,"-out",cert,"-days","1","-subj","/CN=127.0.0.1","-addext","subjectAltName=IP:127.0.0.1"]);
  const secret=randomBytes(32).toString("base64url");
  const reservation=createHttpServer();await new Promise<void>(resolve=>reservation.listen(0,"127.0.0.1",resolve));
  const backendPort=(reservation.address() as {port:number}).port;await new Promise<void>(resolve=>reservation.close(()=>resolve()));
  let publicHost="";
  const proxy=createHttpsServer({key:await readFile(key),cert:await readFile(cert)},(incoming,outgoing)=>{
    if(incoming.headers.host!==publicHost){outgoing.writeHead(421);outgoing.end();return;}
    const headers={...incoming.headers,host:publicHost,"x-forwarded-host":publicHost,"x-forwarded-proto":"https","x-forwarded-port":publicHost.split(":").at(-1)!,"x-all-items-proxy-secret":secret};
    delete headers.forwarded;
    const upstream=httpRequest({hostname:"127.0.0.1",port:backendPort,path:incoming.url,method:incoming.method,headers},response=>{outgoing.writeHead(response.statusCode??502,response.headers);response.pipe(outgoing);});
    upstream.on("error",()=>{if(!outgoing.headersSent)outgoing.writeHead(502);outgoing.end();});incoming.pipe(upstream);
  });
  await new Promise<void>(resolve=>proxy.listen(0,"127.0.0.1",resolve));
  const publicPort=(proxy.address() as {port:number}).port;publicHost=`127.0.0.1:${publicPort}`;
  const origin=`https://${publicHost}`;
  const app=spawn(process.execPath,["node_modules/next/dist/bin/next","start","--hostname","127.0.0.1","--port",String(backendPort)],{cwd:process.cwd(),env:{...process.env,ALL_ITEMS_DATA_DIR:directory,ALL_ITEMS_ORIGIN:origin,ALL_ITEMS_PROXY_MODE:"https-proxy",ALL_ITEMS_PROXY_SECRET:secret,ALL_ITEMS_TELEGRAM_CLIENT_ID:"123456789",ALL_ITEMS_TELEGRAM_CLIENT_SECRET:"synthetic-client-secret-123456789",NODE_ENV:"production"},windowsHide:true,stdio:["ignore","pipe","pipe"]});
  let startupOutput="";for(const stream of[app.stdout,app.stderr])stream.on("data",chunk=>{startupOutput=(startupOutput+String(chunk)).slice(-1500);});
  const context=await browser.newContext({ignoreHTTPSErrors:true,locale:"en-US"});
  try{
    let ready=false;
    for(let attempt=0;attempt<100;attempt++){
      if(app.exitCode!==null)throw new Error(`Synthetic production server exited before readiness: ${startupOutput}`);
      ready=await new Promise<boolean>(resolve=>{const request=httpsRequest(origin+"/login",{rejectUnauthorized:false},response=>{response.resume();resolve(response.statusCode===200);});request.on("error",()=>resolve(false));request.end();});
      if(ready)break;await new Promise(resolve=>setTimeout(resolve,300));
    }
    expect(ready,`Synthetic production server must start behind TLS: ${startupOutput}`).toBe(true);
    const page=await context.newPage();
    const login=await page.goto(origin+"/login");expect(login?.status()).toBe(200);
    await expect(page.getByRole("button",{name:"Sign in with Telegram"})).toBeVisible();
    for(const [locale,label] of [["ru","Войти через Telegram"],["uk","Увійти через Telegram"],["sr-Latn","Prijavi se preko Telegrama"],["zh-Hans","使用 Telegram 登录"],["en","Sign in with Telegram"]]){
      await context.addCookies([{name:"all-items-language",value:locale,url:origin}]);await page.reload();
      await expect(page.getByRole("button",{name:label}).first()).toBeVisible();
    }
    await page.setViewportSize({width:360,height:640});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.setViewportSize({width:1280,height:800});
    const badInvite=await page.request.post(origin+"/auth/telegram/start",{form:{intent:"invite",invite:"invalid"},headers:{accept:"application/json",origin}});
    expect(badInvite.status()).toBe(400);expect((await badInvite.json()).error).toBe("authTelegramInviteInvalid");
    expect(login?.headers()["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(login?.headers()["cache-control"]).toContain("no-store");
    expect(await page.evaluate(()=>({protocol:location.protocol,secure:isSecureContext}))).toEqual({protocol:"https:",secure:true});
    await page.locator('input[name="username"]').fill(syntheticAccounts.owner.username);
    await page.locator('input[name="password"]').fill(syntheticAccounts.owner.password);
    await page.locator('.login-form button[type="submit"]').click();
    await expect(page).toHaveURL(/\/inventories\/[a-f0-9-]{36}$/);
    await expect(page.locator(".app-shell .brand-mark")).toHaveText("A");
    await page.locator(".account-menu summary").click();
    await page.getByRole("link",{name:"Account settings"}).click();
    await expect(page.getByRole("heading",{name:"Account settings"})).toBeVisible();
    await expect(page.getByRole("button",{name:"Connect Telegram"})).toBeVisible();
    await page.getByRole("link",{name:"Back to inventory"}).click();
    const cookie=(await context.cookies()).find(value=>value.name==="all-items-session");
    expect(cookie).toMatchObject({secure:true,httpOnly:true,sameSite:"Strict"});
    expect((await page.request.get(origin+"/login",{headers:{host:"attacker.test"}})).status()).toBe(421);
    expect((await page.request.post(origin+"/api/import/preview",{headers:{origin:"https://attacker.test"},data:"synthetic"})).status()).toBe(403);
    expect((await page.request.get(origin+"/_next/image?url=%2Fmedia%2Fsynthetic&w=640&q=75")).status()).toBe(404);
    const direct={host:publicHost,"x-forwarded-host":publicHost,"x-forwarded-proto":"https","x-forwarded-port":String(publicPort)};
    expect((await page.request.get(`http://127.0.0.1:${backendPort}/login`,{headers:direct})).status()).toBe(403);
    expect((await page.request.get(`http://127.0.0.1:${backendPort}/login`,{headers:{...direct,"x-all-items-proxy-secret":"forged"}})).status()).toBe(403);
  }finally{
    await context.close();app.kill();await new Promise<void>(resolve=>proxy.close(()=>resolve()));
  }
});
