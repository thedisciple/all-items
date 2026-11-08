import {afterAll,beforeAll,expect,it} from "vitest";
import {createClient,type Client} from "@libsql/client";
import {createHash,generateKeyPairSync,sign} from "node:crypto";
import {mkdtemp} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {pathToFileURL} from "node:url";
import * as oidc from "openid-client";
import {applyMigrations} from "@/db/migrate";
import {ORIGINAL_OWNER_ID,provisionAccount,sessionTokenHash,sessionUser,signIn} from "./core";
import {TELEGRAM_ISSUER,type TelegramConfig} from "./telegram-config";
import {beginTelegramFlow,cancelTelegramLink,claimTelegramFlow,confirmTelegramLink,createTelegramInvite,finishTelegramFlow,linkedTelegram,revokeTelegramInvite,unlinkTelegram,verifyTelegramCallback} from "./telegram";

let directory:string,client:Client;
const password="Synthetic local owner password",config:TelegramConfig={clientId:"123456789",clientSecret:"synthetic-client-secret-123456789",redirectUri:"https://pilot.example.test/auth/telegram/callback"};
const metadata={issuer:TELEGRAM_ISSUER,authorization_endpoint:TELEGRAM_ISSUER+"/auth",token_endpoint:TELEGRAM_ISSUER+"/token",jwks_uri:TELEGRAM_ISSUER+"/.well-known/jwks.json",response_types_supported:["code"],id_token_signing_alg_values_supported:["RS256"]};
const mockProvider=()=>new oidc.Configuration(metadata,config.clientId,{client_secret:config.clientSecret,id_token_signed_response_alg:"RS256"},oidc.ClientSecretBasic(config.clientSecret));
beforeAll(async()=>{directory=await mkdtemp(path.join(os.tmpdir(),"all-items-p2-telegram-"));client=createClient({url:pathToFileURL(path.join(directory,"all-items.db")).href});await applyMigrations(client,path.join(process.cwd(),"src/db/migrations"));await provisionAccount(client,"owner",password,true);});
afterAll(()=>client.close());

it("keeps invites single-use and non-admin, resists expiry/replay/collision, and retains password access",async()=>{
  const first=await createTelegramInvite(client,"invitee");
  await expect(createTelegramInvite(client,"invitee")).rejects.toThrow();
  const started=await beginTelegramFlow(client,config,{intent:"invite",inviteToken:first.token},Date.now(),mockProvider());
  expect(started.url.origin).toBe(TELEGRAM_ISSUER);
  expect(started.url.searchParams.get("scope")).toBe("openid");
  expect(started.url.searchParams.get("code_challenge_method")).toBe("S256");
  expect(started.url.searchParams.get("nonce")).toBeTruthy();
  const claimed=await claimTelegramFlow(client,started.state);
  await expect(claimTelegramFlow(client,started.state)).rejects.toThrow();
  await expect(claimTelegramFlow(client,"a".repeat(43))).rejects.toThrow();
  const created=await finishTelegramFlow(client,directory,claimed,"telegram-subject-one");
  expect(created.kind).toBe("session");if(created.kind!=="session")throw new Error("Expected session");
  expect(created.user.isAdmin).toBe(false);
  expect((await sessionUser(created.token,client,directory))?.username).toBe("invitee");
  await expect(beginTelegramFlow(client,config,{intent:"invite",inviteToken:first.token},Date.now(),mockProvider())).rejects.toThrow();
  const login=await beginTelegramFlow(client,config,{intent:"login"},Date.now(),mockProvider());
  const returned=await finishTelegramFlow(client,directory,await claimTelegramFlow(client,login.state),"telegram-subject-one");
  expect(returned.kind).toBe("session");
  const collision=await createTelegramInvite(client,"invitee-two");
  const collisionFlow=await beginTelegramFlow(client,config,{intent:"invite",inviteToken:collision.token},Date.now(),mockProvider());
  await expect(finishTelegramFlow(client,directory,await claimTelegramFlow(client,collisionFlow.state),"telegram-subject-one")).rejects.toThrow();
  expect((await client.execute({sql:"SELECT used_at FROM auth_telegram_invites WHERE token_hash=?",args:[createHash("sha256").update(collision.token).digest("hex")]})).rows[0]?.used_at).toBeNull();
  expect(await revokeTelegramInvite(client,"invitee-two")).toBe(1);
  await expect(beginTelegramFlow(client,config,{intent:"invite",inviteToken:collision.token},Date.now(),mockProvider())).rejects.toThrow();
  const expired=await createTelegramInvite(client,"expired",Date.now()-3_600_001);
  await expect(beginTelegramFlow(client,config,{intent:"invite",inviteToken:expired.token},Date.now(),mockProvider())).rejects.toThrow();
  const unknown=await beginTelegramFlow(client,config,{intent:"login"},Date.now(),mockProvider());
  await expect(finishTelegramFlow(client,directory,await claimTelegramFlow(client,unknown.state),"unlinked-subject")).rejects.toThrow();
  const stale=await beginTelegramFlow(client,config,{intent:"login"},Date.now()-301_000,mockProvider());
  await expect(claimTelegramFlow(client,stale.state)).rejects.toThrow();
  expect((await signIn(client,directory,"owner",password)).user.id).toBe(ORIGINAL_OWNER_ID);
  await expect(unlinkTelegram(client,created.user.id,"anything")).rejects.toThrow();
});

it("binds a pending link to its authenticated session and requires password to unlink",async()=>{
  const owner=await signIn(client,directory,"owner",password);
  const flow=await beginTelegramFlow(client,config,{intent:"link",userId:owner.user.id,sessionToken:owner.token,directory},Date.now(),mockProvider());
  const claimed=await claimTelegramFlow(client,flow.state);
  expect((await finishTelegramFlow(client,directory,claimed,"owner-telegram-subject")).kind).toBe("pending");
  const sessionHash=await sessionTokenHash(owner.token,directory);
  await expect(confirmTelegramLink(client,flow.state,owner.user.id,"wrong-session")).rejects.toThrow();
  await confirmTelegramLink(client,flow.state,owner.user.id,sessionHash);
  expect(await linkedTelegram(client,owner.user.id)).toBe(true);
  await expect(confirmTelegramLink(client,flow.state,owner.user.id,sessionHash)).rejects.toThrow();
  await expect(unlinkTelegram(client,owner.user.id,"incorrect password")).rejects.toThrow();
  expect(await linkedTelegram(client,owner.user.id)).toBe(true);
  await unlinkTelegram(client,owner.user.id,password);
  expect(await linkedTelegram(client,owner.user.id)).toBe(false);
  const cancel=await beginTelegramFlow(client,config,{intent:"link",userId:owner.user.id,sessionToken:owner.token,directory},Date.now(),mockProvider());
  await finishTelegramFlow(client,directory,await claimTelegramFlow(client,cancel.state),"cancelled-subject");
  await cancelTelegramLink(client,cancel.state,owner.user.id,sessionHash);
  await expect(confirmTelegramLink(client,cancel.state,owner.user.id,sessionHash)).rejects.toThrow();
});

it("verifies a signed ID token, nonce, issuer, audience and signature via the OIDC client",async()=>{
  const {privateKey,publicKey}=generateKeyPairSync("rsa",{modulusLength:2048});
  const jwk={...publicKey.export({format:"jwk"}),kid:"synthetic-key",alg:"RS256",use:"sig"};
  const flow={verifier:oidc.randomPKCECodeVerifier(),nonce:oidc.randomNonce()};
  const url=new URL(config.redirectUri+"?code=synthetic-code&state=synthetic-state");
  let variant:"valid"|"nonce"|"issuer"|"audience"|"signature"|"expired"|"future"="valid";
  const provider=mockProvider();oidc.enableNonRepudiationChecks(provider);
  provider[oidc.customFetch]=async(input,init)=>{
    const endpoint=String(input);
    if(endpoint.endsWith("/jwks.json"))return new Response(JSON.stringify({keys:[jwk]}),{headers:{"content-type":"application/json"}});
    if(endpoint.endsWith("/token")){
      const body=String(init?.body);expect(body).toContain("code_verifier=");
      if(new URLSearchParams(body).get("code_verifier")!==flow.verifier)return new Response(JSON.stringify({error:"invalid_grant"}),{status:400,headers:{"content-type":"application/json"}});
      const now=Math.floor(Date.now()/1000),claims={iss:variant==="issuer"?"https://attacker.test":TELEGRAM_ISSUER,sub:"verified-subject",aud:variant==="audience"?"999999999":config.clientId,exp:variant==="expired"?now-100:now+300,iat:variant==="future"?now+1000:now,nonce:variant==="nonce"?"wrong":flow.nonce};
      const header=Buffer.from(JSON.stringify({alg:"RS256",typ:"JWT",kid:"synthetic-key"})).toString("base64url"),payload=Buffer.from(JSON.stringify(claims)).toString("base64url"),content=header+"."+payload;
      const signature=sign("RSA-SHA256",Buffer.from(content),variant==="signature"?generateKeyPairSync("rsa",{modulusLength:2048}).privateKey:privateKey).toString("base64url");
      return new Response(JSON.stringify({access_token:"synthetic-access",token_type:"Bearer",expires_in:300,id_token:content+"."+signature}),{headers:{"content-type":"application/json","cache-control":"no-store"}});
    }
    throw new Error("Unexpected mock OIDC endpoint");
  };
  expect(await verifyTelegramCallback(config,url,flow,provider)).toBe("verified-subject");
  for(const failure of ["nonce","issuer","audience","signature","expired","future"] as const){variant=failure;await expect(verifyTelegramCallback(config,url,flow,provider)).rejects.toThrow();}
  variant="valid";
  await expect(verifyTelegramCallback(config,url,{...flow,verifier:"wrong"},provider)).rejects.toThrow();
  await expect(verifyTelegramCallback(config,new URL(config.redirectUri.replace("/callback","/wrong")+"?code=x&state=y"),flow,provider)).rejects.toThrow();
  provider[oidc.customFetch]=async()=>{throw new Error("Synthetic Telegram outage");};
  await expect(verifyTelegramCallback(config,url,flow,provider)).rejects.toThrow();
});

it("bounds installation-wide Telegram flow starts before provider discovery",async()=>{
  await client.execute("UPDATE auth_login_buckets SET attempts=30 WHERE bucket='telegram-start'");
  await expect(beginTelegramFlow(client,config,{intent:"login"})).rejects.toThrow("temporarily limited");
});
