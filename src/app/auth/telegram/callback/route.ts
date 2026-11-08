import {NextResponse} from "next/server";
import {cookies} from "next/headers";
import {dataDirectory,getDatabase} from "@/db/client";
import {SESSION_COOKIE,SESSION_SECONDS} from "@/auth/core";
import {trustedOrigin,validRequest} from "@/auth/policy";
import {telegramConfig} from "@/auth/telegram-config";
import {claimTelegramFlow,finishTelegramFlow,sameOpaqueToken,verifyTelegramCallback} from "@/auth/telegram";

const flowCookie="all-items-telegram-flow",pendingCookie="all-items-telegram-pending";
function clearFlow(response:NextResponse){response.cookies.set(flowCookie,"",{httpOnly:true,secure:true,sameSite:"lax",path:"/auth/telegram",maxAge:0});}
export async function GET(request:Request){
  if(!validRequest(request.headers))return new Response(null,{status:403});
  const origin=trustedOrigin(),canonical=new URL(origin.origin+"/auth/telegram/callback"+new URL(request.url).search);
  const jar=await cookies(),state=canonical.searchParams.get("state")??"",saved=jar.get(flowCookie)?.value??"";
  let destination="/login?telegram=failed";
  try{
    const config=telegramConfig();if(!config||!state||!saved||!sameOpaqueToken(state,saved)||canonical.searchParams.has("error"))throw new Error("Flow unavailable");
    const db=(await getDatabase()).$client,flow=await claimTelegramFlow(db,state);
    const subject=await verifyTelegramCallback(config,canonical,flow);
    const result=await finishTelegramFlow(db,dataDirectory(),flow,subject);
    if(result.kind==="pending"){
      destination="/auth/telegram/continue?mode=link";
      const response=NextResponse.redirect(new URL(destination,origin),303);
      clearFlow(response);
      response.cookies.set(pendingCookie,state,{httpOnly:true,secure:true,sameSite:"strict",path:"/account",maxAge:300});
      response.headers.set("Cache-Control","private, no-store");return response;
    }
    const response=NextResponse.redirect(new URL("/auth/telegram/continue",origin),303);
    clearFlow(response);
    response.cookies.set(SESSION_COOKIE,result.token,{httpOnly:true,secure:true,sameSite:"strict",path:"/",maxAge:SESSION_SECONDS});
    response.cookies.delete("all-items-inventory");response.headers.set("Cache-Control","private, no-store");return response;
  }catch{
    const response=NextResponse.redirect(new URL(destination,origin),303);clearFlow(response);response.headers.set("Cache-Control","private, no-store");return response;
  }
}
