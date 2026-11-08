import {createHash,randomBytes,randomUUID,timingSafeEqual} from "node:crypto";
import type {Client} from "@libsql/client";
import * as oidc from "openid-client";
import {z} from "zod";
import {federatedSession,reauthenticateUser,sessionTokenHash,usernameSchema} from "./core";
import {TELEGRAM_ISSUER,type TelegramConfig} from "./telegram-config";

const FLOW_MS=5*60_000,INVITE_MS=60*60_000;
const tokenSchema=z.string().regex(/^[A-Za-z0-9_-]{43}$/);
const intentSchema=z.enum(["login","invite","link"]);
const digest=(value:string)=>createHash("sha256").update(value).digest("hex");
const identityIssuer=TELEGRAM_ISSUER;
export type TelegramIntent=z.infer<typeof intentSchema>;

export function sameOpaqueToken(a:string,b:string){return a.length===b.length&&timingSafeEqual(Buffer.from(a),Buffer.from(b));}

export async function createTelegramInvite(client:Client,username:unknown,now=Date.now()){
  const name=usernameSchema.parse(username),token=randomBytes(32).toString("base64url"),hash=digest(token);
  const tx=await client.transaction("write");try{
    const existing=(await tx.execute({sql:"SELECT id FROM auth_users WHERE username=?",args:[name]})).rows.length;
    const active=(await tx.execute({sql:"SELECT token_hash FROM auth_telegram_invites WHERE username=? AND used_at IS NULL AND revoked_at IS NULL AND expires_at>?",args:[name,now]})).rows.length;
    if(existing||active)throw new Error("Username unavailable");
    await tx.execute({sql:"INSERT INTO auth_telegram_invites(token_hash,username,expires_at,created_at) VALUES(?,?,?,?)",args:[hash,name,now+INVITE_MS,now]});
    await tx.commit();return{token,expiresAt:now+INVITE_MS};
  }catch(error){await tx.rollback();throw error;}
}
export async function revokeTelegramInvite(client:Client,username:unknown,now=Date.now()){
  const name=usernameSchema.parse(username);
  const result=await client.execute({sql:"UPDATE auth_telegram_invites SET revoked_at=? WHERE username=? AND used_at IS NULL AND revoked_at IS NULL",args:[now,name]});
  return result.rowsAffected;
}
export async function telegramClient(config:TelegramConfig){
  const client=await oidc.discovery(new URL(TELEGRAM_ISSUER),config.clientId,{client_secret:config.clientSecret,id_token_signed_response_alg:"RS256",token_endpoint_auth_method:"client_secret_basic"},oidc.ClientSecretBasic(config.clientSecret),{execute:[oidc.enableNonRepudiationChecks],timeout:10});
  const metadata=client.serverMetadata();
  if(metadata.issuer!==TELEGRAM_ISSUER||metadata.authorization_endpoint!==TELEGRAM_ISSUER+"/auth"||metadata.token_endpoint!==TELEGRAM_ISSUER+"/token"||metadata.jwks_uri!==TELEGRAM_ISSUER+"/.well-known/jwks.json")throw new Error("Untrusted Telegram discovery document");
  return client;
}
export type FlowStart={intent:TelegramIntent;inviteToken?:unknown;userId?:string;sessionToken?:string;directory?:string};
export async function beginTelegramFlow(client:Client,config:TelegramConfig,input:FlowStart,now=Date.now(),provider?:oidc.Configuration){
  const intent=intentSchema.parse(input.intent);
  const inviteHash=intent==="invite"?digest(tokenSchema.parse(input.inviteToken)):null;
  const sessionHash=intent==="link"?await sessionTokenHash(input.sessionToken??"",input.directory??""):null;
  if(intent==="link"&&!input.userId)throw new Error("Link requires an authenticated account");
  const state=randomBytes(32).toString("base64url"),nonce=oidc.randomNonce(),verifier=oidc.randomPKCECodeVerifier();
  const challenge=await oidc.calculatePKCECodeChallenge(verifier);
  const tx=await client.transaction("write");try{
    await tx.execute({sql:"DELETE FROM auth_oidc_flows WHERE expires_at<=?",args:[now]});
    await tx.execute({sql:"DELETE FROM auth_login_buckets WHERE started_at<=?",args:[now-15*60_000]});
    const budget=(await tx.execute({sql:"SELECT attempts FROM auth_login_buckets WHERE bucket='telegram-start'"})).rows[0];
    if(budget&&Number(budget.attempts)>=30)throw new Error("Telegram start temporarily limited");
    await tx.execute({sql:"INSERT INTO auth_login_buckets(bucket,started_at,attempts) VALUES('telegram-start',?,1) ON CONFLICT(bucket) DO UPDATE SET attempts=attempts+1",args:[now]});
    if(intent==="invite"&&!(await tx.execute({sql:"SELECT token_hash FROM auth_telegram_invites WHERE token_hash=? AND used_at IS NULL AND revoked_at IS NULL AND expires_at>?",args:[inviteHash,now]})).rows.length)throw new Error("Invite unavailable");
    if(intent==="link"&&!(await tx.execute({sql:"SELECT id FROM auth_users WHERE id=? AND disabled=0 AND password_hash IS NOT NULL",args:[input.userId!]})).rows.length)throw new Error("Account unavailable");
    await tx.execute({sql:"INSERT INTO auth_oidc_flows(state_hash,code_verifier,nonce,intent,invite_hash,user_id,session_hash,status,expires_at) VALUES(?,?,?,?,?,?,?,'started',?)",args:[digest(state),verifier,nonce,intent,inviteHash,input.userId??null,sessionHash,now+FLOW_MS]});
    await tx.commit();
  }catch(error){await tx.rollback();throw error;}
  const flowProvider=provider??await telegramClient(config);
  const url=oidc.buildAuthorizationUrl(flowProvider,{client_id:config.clientId,redirect_uri:config.redirectUri,response_type:"code",scope:"openid",state,nonce,code_challenge:challenge,code_challenge_method:"S256"});
  return{state,url};
}
export async function claimTelegramFlow(client:Client,state:unknown,now=Date.now()){
  const hash=digest(tokenSchema.parse(state));
  const result=await client.execute({sql:"UPDATE auth_oidc_flows SET status='exchanging' WHERE state_hash=? AND status='started' AND expires_at>? RETURNING code_verifier,nonce,intent,invite_hash,user_id,session_hash",args:[hash,now]});
  const row=result.rows[0];if(!row)throw new Error("Flow unavailable");
  return{hash,verifier:String(row.code_verifier),nonce:String(row.nonce),intent:intentSchema.parse(row.intent),inviteHash:row.invite_hash===null?null:String(row.invite_hash),userId:row.user_id===null?null:String(row.user_id),sessionHash:row.session_hash===null?null:String(row.session_hash)};
}
export async function verifyTelegramCallback(config:TelegramConfig,canonicalUrl:URL,flow:{verifier:string;nonce:string},provider?:oidc.Configuration){
  if(canonicalUrl.origin+canonicalUrl.pathname!==config.redirectUri)throw new Error("Unexpected callback URI");
  const checked=await oidc.authorizationCodeGrant(provider??await telegramClient(config),canonicalUrl,{pkceCodeVerifier:flow.verifier,expectedNonce:flow.nonce,expectedState:canonicalUrl.searchParams.get("state")??"",idTokenExpected:true});
  const claims=checked.claims();
  const header=checked.id_token?JSON.parse(Buffer.from(checked.id_token.split(".")[0]??"","base64url").toString("utf8")):null;
  const now=Date.now()/1000;
  if(header?.alg!=="RS256"||!claims||claims.iss!==identityIssuer||!claims.sub||claims.aud!==config.clientId||claims.nonce!==flow.nonce||!Number.isInteger(claims.iat)||claims.iat>now+60||claims.iat<now-360||!Number.isInteger(claims.exp)||claims.exp<=now-60)throw new Error("Invalid Telegram identity claims");
  return claims.sub;
}
export async function finishTelegramFlow(client:Client,directory:string,flow:{hash:string;intent:TelegramIntent;inviteHash:string|null;userId:string|null;sessionHash:string|null},subject:string,now=Date.now()){
  const identity=z.string().min(1).max(256).parse(subject);
  if(flow.intent==="link"){
    const changed=await client.execute({sql:"UPDATE auth_oidc_flows SET status='pending',subject=? WHERE state_hash=? AND status='exchanging' AND expires_at>?",args:[identity,flow.hash,now]});
    if(changed.rowsAffected!==1)throw new Error("Flow unavailable");
    return{kind:"pending" as const};
  }
  const tx=await client.transaction("write");let userId:string;
  try{
    if(!(await tx.execute({sql:"SELECT state_hash FROM auth_oidc_flows WHERE state_hash=? AND status='exchanging' AND expires_at>?",args:[flow.hash,now]})).rows.length)throw new Error("Flow unavailable");
    const linked=(await tx.execute({sql:"SELECT user_id FROM auth_external_identities WHERE provider='telegram' AND issuer=? AND subject=?",args:[identityIssuer,identity]})).rows[0];
    if(flow.intent==="login"){
      if(!linked)throw new Error("Telegram identity is not linked");
      userId=String(linked.user_id);
    }else{
      if(linked||!flow.inviteHash)throw new Error("Invite cannot bind this identity");
      const invite=(await tx.execute({sql:"UPDATE auth_telegram_invites SET used_at=? WHERE token_hash=? AND used_at IS NULL AND revoked_at IS NULL AND expires_at>? RETURNING username",args:[now,flow.inviteHash,now]})).rows[0];
      if(!invite)throw new Error("Invite unavailable");
      userId=randomUUID();
      await tx.execute({sql:"INSERT INTO auth_users(id,username,password_hash,is_admin,disabled,created_at) VALUES(?,?,NULL,0,0,?)",args:[userId,String(invite.username),new Date(now).toISOString()]});
      await tx.execute({sql:"INSERT INTO auth_external_identities(provider,issuer,subject,user_id,linked_at) VALUES('telegram',?,?,?,?)",args:[identityIssuer,identity,userId,now]});
    }
    await tx.execute({sql:"DELETE FROM auth_oidc_flows WHERE state_hash=?",args:[flow.hash]});await tx.commit();
  }catch(error){await tx.rollback();throw error;}
  return{kind:"session" as const,...await federatedSession(client,directory,userId,now)};
}
export async function confirmTelegramLink(client:Client,flowState:string,userId:string,sessionHash:string,now=Date.now()){
  const hash=digest(tokenSchema.parse(flowState)),tx=await client.transaction("write");try{
    const flow=(await tx.execute({sql:"SELECT subject FROM auth_oidc_flows WHERE state_hash=? AND intent='link' AND status='pending' AND user_id=? AND session_hash=? AND expires_at>?",args:[hash,userId,sessionHash,now]})).rows[0];
    if(!flow)throw new Error("Link unavailable");
    const existing=(await tx.execute({sql:"SELECT user_id FROM auth_external_identities WHERE provider='telegram' AND issuer=? AND subject=?",args:[identityIssuer,String(flow.subject)]})).rows[0];
    if(existing)throw new Error("Telegram identity already linked");
    await tx.execute({sql:"INSERT INTO auth_external_identities(provider,issuer,subject,user_id,linked_at) VALUES('telegram',?,?,?,?)",args:[identityIssuer,String(flow.subject),userId,now]});
    await tx.execute({sql:"DELETE FROM auth_oidc_flows WHERE state_hash=?",args:[hash]});await tx.commit();
  }catch(error){await tx.rollback();throw error;}
}
export async function cancelTelegramLink(client:Client,flowState:string,userId:string,sessionHash:string){
  await client.execute({sql:"DELETE FROM auth_oidc_flows WHERE state_hash=? AND intent='link' AND user_id=? AND session_hash=?",args:[digest(tokenSchema.parse(flowState)),userId,sessionHash]});
}
export async function unlinkTelegram(client:Client,userId:string,password:unknown){
  const verifiedHash=await reauthenticateUser(client,userId,password);
  if(!verifiedHash)throw new Error("Password confirmation failed");
  const tx=await client.transaction("write");try{
    const row=(await tx.execute({sql:"SELECT password_hash,disabled FROM auth_users WHERE id=?",args:[userId]})).rows[0];
    if(!row||row.disabled!==0||row.password_hash!==verifiedHash)throw new Error("A current password is required before unlinking");
    const changed=await tx.execute({sql:"DELETE FROM auth_external_identities WHERE user_id=? AND provider='telegram' AND issuer=?",args:[userId,identityIssuer]});
    if(changed.rowsAffected===0)throw new Error("No Telegram connection");
    await tx.execute({sql:"DELETE FROM auth_oidc_flows WHERE user_id=?",args:[userId]});await tx.commit();
  }catch(error){await tx.rollback();throw error;}
}
export async function linkedTelegram(client:Client,userId:string){return Boolean((await client.execute({sql:"SELECT 1 FROM auth_external_identities WHERE user_id=? AND provider='telegram' AND issuer=?",args:[userId,identityIssuer]})).rows.length);}
