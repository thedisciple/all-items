"use server";
import {cookies,headers} from "next/headers";
import {redirect} from "next/navigation";
import {dataDirectory,getDatabase} from "@/db/client";
import {LoginError,SESSION_COOKIE,SESSION_SECONDS,signIn,revokeSession} from "@/auth/core";
import {trustedOrigin,validRequest} from "@/auth/policy";
export type LoginFeedback={code:""|"authInvalid"|"authThrottled"|"authUnavailable"};
export async function loginAction(_previous:LoginFeedback,data:FormData):Promise<LoginFeedback>{
  if(!validRequest(await headers(),true))return{code:"authUnavailable"};
  try{
    const result=await signIn((await getDatabase()).$client,dataDirectory(),data.get("username"),data.get("password"));
    const jar=await cookies();jar.delete(SESSION_COOKIE);jar.set(SESSION_COOKIE,result.token,{httpOnly:true,sameSite:"strict",secure:trustedOrigin().protocol==="https:",path:"/",maxAge:SESSION_SECONDS});jar.delete("all-items-inventory");
  }catch(error){return{code:error instanceof LoginError?error.code:"authUnavailable"};}
  redirect("/");
}
export async function logoutAction(){
  if(!validRequest(await headers(),true))throw new Error("Request unavailable");
  const jar=await cookies();await revokeSession(jar.get(SESSION_COOKIE)?.value,(await getDatabase()).$client,dataDirectory());jar.delete(SESSION_COOKIE);jar.delete("all-items-inventory");redirect("/login");
}
