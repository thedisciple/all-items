import {createHash,createHmac,randomBytes,randomUUID,scrypt,timingSafeEqual} from "node:crypto";
import {mkdir,readFile,open,lstat,link,rm} from "node:fs/promises";
import path from "node:path";
import type {Client} from "@libsql/client";
import {z} from "zod";
import {dataDirectory,getDatabase} from "@/db/client";
import {assertPrivatePath} from "@/media/private-paths";

export const ORIGINAL_OWNER_ID="00000000-0000-4000-8000-000000000010";
export const SESSION_COOKIE="all-items-session";
export const SESSION_SECONDS=8*60*60;
const IDLE_MS=30*60*1000,WINDOW_MS=15*60*1000;
export type User={id:string;username:string;isAdmin:boolean};
export class AccessError extends Error{constructor(public status:401|403|404){super("Access unavailable");}}
export class LoginError extends Error{constructor(public code:"authInvalid"|"authThrottled"){super("Sign in unavailable");}}
export const usernameSchema=z.string().trim().toLowerCase().regex(/^[a-z0-9][a-z0-9._-]{2,63}$/);
export const passwordSchema=z.string().min(12).max(256).refine(value=>Buffer.byteLength(value,"utf8")<=1024);
async function derive(password:string,salt:Buffer):Promise<Buffer>{return new Promise((resolve,reject)=>scrypt(password,salt,64,{N:131072,r:8,p:1,maxmem:192*1024*1024},(error,key)=>error?reject(error):resolve(key)));}
export async function hashPassword(value:unknown){const password=passwordSchema.parse(value),salt=randomBytes(16);return `scrypt:131072:8:1:${salt.toString("hex")}:${(await derive(password,salt)).toString("hex")}`;}
async function verifyPassword(password:string,encoded:unknown){
  const parsed=typeof encoded==="string"?/^scrypt:131072:8:1:([a-f0-9]{32}):([a-f0-9]{128})$/.exec(encoded):null;
  // Unknown users still pay the same derivation cost, after reserving the same login budget.
  const actual=await derive(password,Buffer.from(parsed?.[1]??"0".repeat(32),"hex"));
  return Boolean(parsed&&timingSafeEqual(actual,Buffer.from(parsed[2]!,"hex")));
}
async function sessionKey(directory:string){
  await mkdir(directory,{recursive:true});const file=path.join(directory,"auth-session-key");await assertPrivatePath(directory,file);
  try{await lstat(file);}catch(error){
    if(!(error instanceof Error&&"code"in error&&error.code==="ENOENT"))throw error;
    const temporary=path.join(directory,`.auth-key-${randomUUID()}`);await assertPrivatePath(directory,temporary);
    const handle=await open(temporary,"wx",0o600);try{await handle.writeFile(randomBytes(32));await handle.sync();}finally{await handle.close();}
    try{await link(temporary,file);}catch(error){if(!(error instanceof Error&&"code"in error&&error.code==="EEXIST"))throw error;}finally{await rm(temporary,{force:true});}
  }
  const stat=await lstat(file);if(!stat.isFile()||stat.isSymbolicLink()||stat.size!==32)throw new Error("Invalid local session key");
  return readFile(file);
}
async function tokenHash(token:string,directory:string){return createHmac("sha256",await sessionKey(directory)).update(token).digest("hex");}
export async function provisionAccount(client:Client,username:unknown,password:unknown,owner=false):Promise<User>{
  const name=usernameSchema.parse(username),encoded=await hashPassword(password),id=owner?ORIGINAL_OWNER_ID:randomUUID();
  const tx=await client.transaction("write");try{
    if(owner){const row=(await tx.execute({sql:"SELECT password_hash,disabled FROM auth_users WHERE id=?",args:[id]})).rows[0];if(!row||row.password_hash!==null)throw new Error("Owner already initialized; use local reset");await tx.execute({sql:"UPDATE auth_users SET username=?,password_hash=?,disabled=0 WHERE id=?",args:[name,encoded,id]});}
    else await tx.execute({sql:"INSERT INTO auth_users(id,username,password_hash,is_admin,disabled,created_at) VALUES(?,?,?,0,0,?)",args:[id,name,encoded,new Date().toISOString()]});
    await tx.commit();return{id,username:name,isAdmin:owner};
  }catch(error){await tx.rollback();throw error;}
}
export async function resetAccount(client:Client,username:unknown,password:unknown){
  const name=usernameSchema.parse(username),encoded=await hashPassword(password);const tx=await client.transaction("write");try{
    const user=(await tx.execute({sql:"SELECT id FROM auth_users WHERE username=?",args:[name]})).rows[0];if(!user)throw new Error("Account unavailable");
    await tx.execute({sql:"UPDATE auth_users SET password_hash=?,disabled=0 WHERE id=?",args:[encoded,user.id]});await tx.execute({sql:"DELETE FROM auth_sessions WHERE user_id=?",args:[user.id]});await tx.commit();
  }catch(error){await tx.rollback();throw error;}
}
export async function signIn(client:Client,directory:string,username:unknown,password:unknown,now=Date.now()){
  const parsed=usernameSchema.safeParse(username),secret=z.string().min(1).max(256).safeParse(password);
  const name=parsed.success?parsed.data:"invalid",bucket=createHash("sha256").update(name).digest("hex");
  const tx=await client.transaction("write");try{
    await tx.execute({sql:"DELETE FROM auth_login_buckets WHERE started_at<=?",args:[now-WINDOW_MS]});
    for(const [key,limit] of [["installation",30],[bucket,5]] as const){
      const previous=(await tx.execute({sql:"SELECT attempts FROM auth_login_buckets WHERE bucket=?",args:[key]})).rows[0];
      if(previous&&Number(previous.attempts)>=limit)throw new LoginError("authThrottled");
      await tx.execute({sql:"INSERT INTO auth_login_buckets(bucket,started_at,attempts) VALUES(?,?,1) ON CONFLICT(bucket) DO UPDATE SET attempts=attempts+1",args:[key,now]});
    }await tx.commit();
  }catch(error){await tx.rollback();throw error;}
  const row=(await client.execute({sql:"SELECT * FROM auth_users WHERE username=?",args:[name]})).rows[0];
  const valid=await verifyPassword(secret.success?secret.data:"invalid",row?.password_hash);
  if(!parsed.success||!secret.success||!row||row.disabled!==0||!valid)throw new LoginError("authInvalid");
  const token=randomBytes(32).toString("base64url"),digest=await tokenHash(token,directory);
  const commit=await client.transaction("write");try{
    // A reset/disable during hashing must not issue a stale authorized session.
    const current=(await commit.execute({sql:"SELECT password_hash,disabled FROM auth_users WHERE id=?",args:[row.id]})).rows[0];
    if(!current||current.disabled!==0||current.password_hash!==row.password_hash)throw new LoginError("authInvalid");
    await commit.execute({sql:"DELETE FROM auth_sessions WHERE expires_at<=? OR last_seen_at<=?",args:[now,now-IDLE_MS]});
    await commit.execute({sql:"DELETE FROM auth_sessions WHERE token_hash IN (SELECT token_hash FROM auth_sessions WHERE user_id=? ORDER BY last_seen_at DESC LIMIT -1 OFFSET 4)",args:[row.id]});
    await commit.execute({sql:"INSERT INTO auth_sessions(token_hash,user_id,expires_at,last_seen_at) VALUES(?,?,?,?)",args:[digest,row.id,now+SESSION_SECONDS*1000,now]});
    await commit.execute({sql:"DELETE FROM auth_login_buckets WHERE bucket=?",args:[bucket]});await commit.commit();
  }catch(error){await commit.rollback();throw error;}
  return{token,user:{id:String(row.id),username:String(row.username),isAdmin:row.is_admin===1} satisfies User};
}
export async function sessionUser(token:unknown,client?:Client,directory=dataDirectory(),now=Date.now(),touch=false):Promise<User|null>{
  if(typeof token!=="string"||!/^[A-Za-z0-9_-]{43}$/.test(token))return null;
  const db=client??(await getDatabase()).$client,digest=await tokenHash(token,directory);
  const result=await db.execute({sql:"SELECT u.id,u.username,u.is_admin FROM auth_sessions s JOIN auth_users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>? AND s.last_seen_at>? AND u.disabled=0",args:[digest,now,now-IDLE_MS]});
  const row=result.rows[0];if(!row)return null;
  if(touch)await db.execute({sql:"UPDATE auth_sessions SET last_seen_at=? WHERE token_hash=? AND last_seen_at<?",args:[now,digest,now-60_000]});
  return{id:String(row.id),username:String(row.username),isAdmin:row.is_admin===1};
}
export async function revokeSession(token:unknown,client:Client,directory:string){if(typeof token==="string"&&/^[A-Za-z0-9_-]{43}$/.test(token))await client.execute({sql:"DELETE FROM auth_sessions WHERE token_hash=?",args:[await tokenHash(token,directory)]});}
