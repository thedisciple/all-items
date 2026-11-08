"use server";
import {cookies} from "next/headers";
import {redirect} from "next/navigation";
import {dataDirectory,getDatabase} from "@/db/client";
import {SESSION_COOKIE,sessionTokenHash} from "@/auth/core";
import {assertActionOrigin,pageUser} from "@/auth/request";
import {cancelTelegramLink,confirmTelegramLink,unlinkTelegram} from "@/auth/telegram";

function clearPending(jar:Awaited<ReturnType<typeof cookies>>){jar.set("all-items-telegram-pending","",{httpOnly:true,secure:true,sameSite:"strict",path:"/account",maxAge:0});}

async function context(){
  await assertActionOrigin();const user=await pageUser(),jar=await cookies(),session=jar.get(SESSION_COOKIE)?.value;
  if(!session)throw new Error("Session unavailable");
  return{user,jar,sessionHash:await sessionTokenHash(session,dataDirectory()),client:(await getDatabase()).$client};
}
export async function confirmTelegramAction(){
  const {user,jar,sessionHash,client}=await context();
  const flow=jar.get("all-items-telegram-pending")?.value;
  if(!flow)redirect("/account?telegram=failed");
  try{await confirmTelegramLink(client,flow,user.id,sessionHash);clearPending(jar);}catch{redirect("/account?telegram=failed");}
  redirect("/account?telegram=linked");
}
export async function cancelTelegramAction(){
  const {user,jar,sessionHash,client}=await context();const flow=jar.get("all-items-telegram-pending")?.value;
  if(flow)await cancelTelegramLink(client,flow,user.id,sessionHash);
  clearPending(jar);redirect("/account");
}
export async function unlinkTelegramAction(data:FormData){
  const {user,client}=await context();
  try{await unlinkTelegram(client,user.id,data.get("password"));}catch{redirect("/account?telegram=failed");}
  redirect("/account?telegram=unlinked");
}
