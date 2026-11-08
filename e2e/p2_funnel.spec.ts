import {test,expect,type Page} from "@playwright/test";
import {randomBytes} from "node:crypto";
import {spawn,execFile,type ChildProcess} from "node:child_process";
import {once} from "node:events";
import {promisify} from "node:util";
import {mkdtemp,readFile,readdir} from "node:fs/promises";
import {createServer,request as httpRequest} from "node:http";
import {createServer as createTLS,request as httpsRequest} from "node:https";
import os from "node:os";
import path from "node:path";
import {syntheticAccounts} from "./helpers/auth-credentials";
import {messages} from "../src/i18n/messages";

test("real loopback Caddy adapter preserves HTTPS sessions and two-user private boundaries",async({browser})=>{
  test.setTimeout(180_000);
  const executable=process.env.ALL_ITEMS_CADDY_EXE;
  test.skip(!executable,"Set ALL_ITEMS_CADDY_EXE to the reviewed Caddy binary; this does not enable Funnel.");
  const directory=await mkdtemp(path.join(os.tmpdir(),"all-items-p2-funnel-"));
  await promisify(execFile)(process.execPath,["--import","tsx","e2e/helpers/p2-funnel-seed.ts"],{env:{...process.env,ALL_ITEMS_DATA_DIR:directory},windowsHide:true});
  const fixtures=JSON.parse(await readFile(path.join(directory,"fixture.json"),"utf8")) as {who:"alice"|"bob";inventory:string;item:string;media:string;collection:string;cover:string}[];
  async function freePort(){const server=createServer();await new Promise<void>(resolve=>server.listen(0,"127.0.0.1",resolve));const port=(server.address() as {port:number}).port;await new Promise<void>(resolve=>server.close(()=>resolve()));return port;}
  const backendPort=await freePort(),adapterPort=await freePort(),secret=randomBytes(32).toString("base64url");
  const openssl=process.platform==="win32"?"C:\\Program Files\\Git\\usr\\bin\\openssl.exe":"openssl",key=path.join(directory,"key.pem"),cert=path.join(directory,"cert.pem");
  await promisify(execFile)(openssl,["req","-x509","-newkey","rsa:2048","-nodes","-keyout",key,"-out",cert,"-days","1","-subj","/CN=127.0.0.1","-addext","subjectAltName=IP:127.0.0.1"]);
  // Simulates only TLS termination/transport. The real Caddy config supplies all trust headers.
  const tls=createTLS({key:await readFile(key),cert:await readFile(cert)},(incoming,outgoing)=>{
    const upstream=httpRequest({hostname:"127.0.0.1",port:adapterPort,path:incoming.url,method:incoming.method,headers:incoming.headers},response=>{outgoing.writeHead(response.statusCode??502,response.headers);response.pipe(outgoing);});
    upstream.on("error",()=>{if(!outgoing.headersSent)outgoing.writeHead(502);outgoing.end();});incoming.pipe(upstream);
  });
  await new Promise<void>(resolve=>tls.listen(0,"127.0.0.1",resolve));
  const port=(tls.address() as {port:number}).port,host=`127.0.0.1:${port}`,origin=`https://${host}`;
  const env:NodeJS.ProcessEnv={...process.env,ALL_ITEMS_DATA_DIR:directory,ALL_ITEMS_NEXT_DIST:".next",ALL_ITEMS_ORIGIN:origin,ALL_ITEMS_PROXY_MODE:"https-proxy",ALL_ITEMS_PROXY_SECRET:secret,ALL_ITEMS_DOMAIN:host,ALL_ITEMS_ADAPTER_PORT:String(adapterPort),ALL_ITEMS_BACKEND_PORT:String(backendPort),ALL_ITEMS_PUBLIC_PORT:String(port),ALL_ITEMS_TELEGRAM_CLIENT_ID:"",ALL_ITEMS_TELEGRAM_CLIENT_SECRET:"",NODE_ENV:"production"};
  const children:ChildProcess[]=[],contexts:Awaited<ReturnType<typeof browser.newContext>>[]=[];
  let output="";
  const launch=(command:string,args:string[])=>{const child=spawn(command,args,{env,windowsHide:true,stdio:["ignore","pipe","pipe"]});children.push(child);for(const stream of[child.stdout,child.stderr])stream?.on("data",chunk=>{output=(output+String(chunk)).slice(-1500);});return child;};
  try{
    launch(process.execPath,["node_modules/next/dist/bin/next","start","--hostname","127.0.0.1","--port",String(backendPort)]);
    launch(executable!,["run","--config","deploy/Caddyfile.funnel.example","--adapter","caddyfile"]);
    await expect.poll(async()=>{
      if(children.some(child=>child.exitCode!==null))throw new Error("Synthetic startup failed: "+output);
      return new Promise<number>(resolve=>{const request=httpsRequest(origin+"/login",{rejectUnauthorized:false},response=>{response.resume();resolve(response.statusCode??0);});request.on("error",()=>resolve(0));request.end();});
    },{timeout:30_000}).toBe(200);
    for(let i=0;i<3;i++)contexts.push(await browser.newContext({ignoreHTTPSErrors:true,locale:"en-US"}));
    const [admin,a,b]=await Promise.all(contexts.map(context=>context.newPage()));
    async function login(page:Page,who:"owner"|"alice"|"bob"){
      await page.goto(origin+"/login");await page.locator('input[name="username"]').fill(syntheticAccounts[who].username);await page.locator('input[name="password"]').fill(syntheticAccounts[who].password);
      await page.locator('.login-form button[type="submit"]').click();await expect(page).toHaveURL(/\/inventories\/[a-f0-9-]{36}$/);
    }
    const unauth=await a!.request.get(origin+`/inventories/${fixtures[0]!.inventory}/api/export/archive`);expect(unauth.status()).toBe(401);
    await login(admin!,"owner");await login(a!,"alice");await login(b!,"bob");
    const alice=fixtures.find(value=>value.who==="alice")!,bob=fixtures.find(value=>value.who==="bob")!,base=`/inventories/${alice.inventory}`;
    await expect(a!.locator(".app-shell .language-switcher")).toHaveCount(0);
    expect(await a!.evaluate(()=>({secure:isSecureContext,protocol:location.protocol}))).toEqual({secure:true,protocol:"https:"});
    expect((await contexts[1]!.cookies()).find(value=>value.name==="all-items-session")).toMatchObject({secure:true,httpOnly:true,sameSite:"Strict"});
    for(const suffix of["",`/items/${alice.item}`,"/api/export/archive","/api/export/csv",...['image','thumbnail','source'].map(variant=>`/media/${alice.item}/${alice.media}?variant=${variant}`),...['image','thumbnail'].map(variant=>`/media/collections/${alice.collection}/${alice.cover}?variant=${variant}`)]){
      expect((await a!.request.get(origin+base+suffix)).status(),suffix).toBe(200);
      const foreign=await b!.request.get(origin+base+suffix);expect(foreign.status(),suffix).toBe(404);expect(foreign.headers()["cache-control"]).toContain("no-store");
    }
    await b!.goto(origin+`/inventories/${bob.inventory}/data`);await expect(b!.locator("#installation-backups-title")).toHaveCount(0);
    await admin!.goto(origin+"/inventories/00000000-0000-4000-8000-000000000001/data");await expect(admin!.locator("#installation-backups-title")).toBeVisible();
    const before=await readdir(path.join(directory,"backups")).catch(()=>[]);
    // Capture the actual hydrated action transport without sending the admin write.
    await admin!.route("**/data",route=>route.request().method()==="POST"?route.abort():route.continue());
    const actionRequest=admin!.waitForRequest(request=>request.method()==="POST"&&Boolean(request.headers()["next-action"]));
    await admin!.getByRole("button",{name:messages.en.installationBackupCreate,exact:true}).click();
    const captured=await actionRequest;await admin!.unroute("**/data");
    const actionId=captured.headers()["next-action"]!,contentType=captured.headers()["content-type"]!;
    const body=captured.postDataBuffer()!.toString("utf8").replaceAll("00000000-0000-4000-8000-000000000001",bob.inventory);
    const denied=await b!.request.post(origin+`/inventories/${bob.inventory}/data`,{data:body,headers:{origin,"next-action":actionId,"content-type":contentType,accept:"text/x-component"}});
    expect(denied.status()).toBe(200);
    expect((await denied.text()).includes("installationBackupFailure")).toBe(true);
    expect(await readdir(path.join(directory,"backups")).catch(()=>[])).toEqual(before);
    const hostileHost=await new Promise<number>((resolve,reject)=>{
      const request=httpsRequest(origin+"/login",{rejectUnauthorized:false,headers:{host:"attacker.invalid"}},response=>{response.resume();resolve(response.statusCode??0);});request.on("error",reject);request.end();
    });
    expect(hostileHost).toBe(421);
    expect((await a!.request.post(origin+base+"/api/import/preview",{headers:{origin:"https://attacker.invalid"},data:"synthetic"})).status()).toBe(403);
    // Public forwarding assertions cannot choose backend trust values; Caddy overwrites them.
    expect((await a!.request.get(origin+base,{headers:{forwarded:"host=attacker.invalid","x-forwarded-host":"attacker.invalid","x-forwarded-proto":"http","x-all-items-proxy-secret":"forged"}})).status()).toBe(200);
    const pinned={host,"x-forwarded-host":host,"x-forwarded-proto":"https","x-forwarded-port":String(port)};
    for(const headers of[pinned,{...pinned,"x-all-items-proxy-secret":"forged"}])expect((await a!.request.get(`http://127.0.0.1:${backendPort}/login`,{headers})).status()).toBe(403);
    await a!.goto(origin+base);await a!.setViewportSize({width:360,height:780});
    // Permission denial is synthetic; this does not claim physical camera acceptance.
    await a!.evaluate(()=>{navigator.mediaDevices.getUserMedia=async()=>{throw new DOMException("Synthetic denial","NotAllowedError");};});
    await a!.locator(".add-dialog-trigger").click();
    const add=a!.getByRole("dialog",{name:messages.en.addItem,exact:true});
    await add.locator('input[name="name"]').fill("Synthetic HTTPS fallback");
    await add.getByRole("button",{name:messages.en.addPhoto,exact:true}).click();
    const sources=a!.locator(".photo-source-dialog");
    await sources.getByRole("button",{name:messages.en.cameraOpen,exact:true}).click();
    await expect(sources.getByRole("alert")).toHaveText(messages.en.cameraDenied);
    await expect(sources.getByRole("button",{name:messages.en.chooseFile,exact:true})).toBeEnabled();
    await add.locator('input[name="photo"]').setInputFiles({name:"synthetic.webp",mimeType:"image/webp",buffer:await readFile(path.join(directory,"media/items",alice.item,alice.media+"-source.webp"))});
    const crop=a!.getByRole("dialog",{name:messages.en.cropTitle,exact:true});
    await expect(crop.getByRole("button",{name:messages.en.cropConfirm,exact:true})).toBeEnabled();await crop.getByRole("button",{name:messages.en.cropConfirm,exact:true}).click();
    await add.getByRole("button",{name:messages.en.saveItem,exact:true}).click();
    await expect(a!.getByRole("link",{name:"Synthetic HTTPS fallback",exact:true})).toBeVisible();
    const outsider=await browser.newContext({ignoreHTTPSErrors:true,locale:"en-US"});contexts.push(outsider);
    const attempt=await outsider.newPage();await attempt.goto(origin+"/login");
    for(let i=0;i<6;i++){
      await attempt.locator('input[name="username"]').fill("synthetic-funnel-rate-limit");await attempt.locator('input[name="password"]').fill("Synthetic incorrect password");
      await attempt.locator('.login-form button[type="submit"]').click();
      await expect(attempt.locator(".login-form").getByRole("alert")).toHaveText(messages.en[i===5?"authThrottled":"authInvalid"]);
    }
  }finally{
    for(const context of contexts)await context.close();
    for(const child of children.reverse())if(child.exitCode===null){const stopped=once(child,"exit");child.kill();await stopped;}
    tls.closeAllConnections();await new Promise<void>(resolve=>tls.close(()=>resolve()));
  }
});
