import {beforeAll,afterAll,it,expect} from "vitest";
import {createClient,type Client} from "@libsql/client";
import {mkdtemp,readFile} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {pathToFileURL} from "node:url";
import {applyMigrations} from "@/db/migrate";
import {provisionAccount,signIn,sessionUser,ORIGINAL_OWNER_ID,reauthenticateUser} from "./core";
let directory:string,client:Client;
const password="Synthetic isolated bootstrap password";
beforeAll(async()=>{directory=await mkdtemp(path.join(os.tmpdir(),"all-items-p1-core-"));client=createClient({url:pathToFileURL(path.join(directory,"all-items.db")).href});await applyMigrations(client,path.join(process.cwd(),"src/db/migrations"));});
afterAll(()=>client.close());
it('reserves persistent reauthentication budgets before hashing and recovers after the fixed window',async()=>{
  const user=await provisionAccount(client,'reauth-limited',password),now=Date.now();for(let attempt=0;attempt<5;attempt++)expect(await reauthenticateUser(client,user.id,'Synthetic incorrect password',now)).toBeNull();
  const reopened=createClient({url:pathToFileURL(path.join(directory,'all-items.db')).href});try{await expect(reauthenticateUser(reopened,user.id,password,now)).rejects.toMatchObject({code:'authThrottled'});expect(await reauthenticateUser(reopened,user.id,password,now+16*60_000)).toMatch(/^scrypt:/);}finally{reopened.close();}
});
it("keeps the owner disabled until explicit bootstrap and never replaces initialized credentials",async()=>{
  const pending=(await client.execute({sql:"SELECT username,password_hash,disabled FROM auth_users WHERE id=?",args:[ORIGINAL_OWNER_ID]})).rows[0]!;expect(pending).toMatchObject({username:null,password_hash:null,disabled:1});
  await expect(signIn(client,directory,"owner",password)).rejects.toMatchObject({code:"authInvalid"});
  await provisionAccount(client,"owner",password,true);const before=(await client.execute("SELECT * FROM auth_users")).rows;
  await expect(provisionAccount(client,"replacement",password,true)).rejects.toThrow("already initialized");expect((await client.execute("SELECT * FROM auth_users")).rows).toEqual(before);
  await expect(provisionAccount(client,"weak-account","short")).rejects.toThrow();expect((await client.execute("SELECT * FROM auth_users")).rows).toEqual(before);
});
it("restores credential access but never old browser tokens into a new installation directory",async()=>{
  const old=await signIn(client,directory,"owner",password),target=await mkdtemp(path.join(os.tmpdir(),"all-items-p1-key-restore-"));
  await client.execute({sql:"VACUUM INTO ?",args:[path.join(target,"all-items.db")]});const restored=createClient({url:pathToFileURL(path.join(target,"all-items.db")).href});
  try{expect(await sessionUser(old.token,restored,target)).toBeNull();expect(await readFile(path.join(directory,"auth-session-key"))).not.toEqual(await readFile(path.join(target,"auth-session-key")));const fresh=await signIn(restored,target,"owner",password);expect((await sessionUser(fresh.token,restored,target))?.id).toBe(ORIGINAL_OWNER_ID);expect(await sessionUser(fresh.token,client,directory)).toBeNull();}finally{restored.close();}
});
