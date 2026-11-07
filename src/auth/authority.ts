import {AsyncLocalStorage} from "node:async_hooks";
import type {Client} from "@libsql/client";
import {z} from "zod";
import {getDatabase} from "@/db/client";
import {AccessError,type User} from "./core";

const maintenance=new AsyncLocalStorage<boolean>();
let requestModule:Promise<typeof import("./request")>|undefined;
// Only trusted, local CLI/startup recovery code may enter this capability. Never export via HTTP.
export function runMaintenance<T>(work:()=>T):T{return maintenance.run(true,work);}
export function inMaintenance(){return maintenance.getStore()===true;}
export async function requireActor():Promise<User>{
  if(inMaintenance())return{id:"offline-maintenance",username:"offline-maintenance",isAdmin:true};
  requestModule??=import("./request");return(await requestModule).requestUser();
}
export async function requireAdmin(){const actor=await requireActor();if(!actor.isAdmin)throw new AccessError(403);return actor;}
export async function authorizeInventory(value:unknown,client?:Pick<Client,"execute">){
  const id=z.uuid().parse(value),actor=await requireActor();if(inMaintenance())return actor;
  const db=client??(await getDatabase()).$client;
  if(!(await db.execute({sql:"SELECT workspace_id FROM inventory_owners WHERE workspace_id=? AND user_id=?",args:[id,actor.id]})).rows.length)throw new AccessError(404);
  return actor;
}
