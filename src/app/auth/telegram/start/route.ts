import {NextResponse} from "next/server";
import {cookies} from "next/headers";
import {z} from "zod";
import {dataDirectory,getDatabase} from "@/db/client";
import {reauthenticateUser,sessionUser,SESSION_COOKIE,LoginError} from "@/auth/core";
import {validRequest,trustedOrigin} from "@/auth/policy";
import {telegramConfig} from "@/auth/telegram-config";
import {beginTelegramFlow} from "@/auth/telegram";

const intentSchema=z.enum(["login","invite","link"]);
const flowCookie="all-items-telegram-flow";
export async function POST(request:Request){
  if(!validRequest(request.headers,true))return new Response(null,{status:403});
  const origin=trustedOrigin();let intent:"login"|"invite"|"link"="login";
  const wantsJson=request.headers.get("accept")?.includes("application/json")??false;
  let failure:"authTelegramFailed"|"authTelegramInviteInvalid"|"authTelegramReauth"|"authThrottled"="authTelegramFailed";
  try{
    const config=telegramConfig();if(!config)throw new Error("Telegram unavailable");
    const form=await request.formData();intent=intentSchema.parse(form.get("intent"));
    const jar=await cookies(),token=jar.get(SESSION_COOKIE)?.value,db=(await getDatabase()).$client;
    let userId:string|undefined;
    if(intent==="link"){
      const user=await sessionUser(token,db,dataDirectory());
      if(!user||!await reauthenticateUser(db,user.id,form.get("password"))){failure="authTelegramReauth";throw new Error("Reauthentication required");}
      userId=user.id;
    }
    if(intent==="invite"&&!z.string().regex(/^[A-Za-z0-9_-]{43}$/).safeParse(form.get("invite")).success){failure="authTelegramInviteInvalid";throw new Error("Invite unavailable");}
    const flow=await beginTelegramFlow(db,config,{intent,inviteToken:form.get("invite"),userId,sessionToken:token,directory:dataDirectory()});
    const response=wantsJson?NextResponse.json({url:flow.url.href}):NextResponse.redirect(flow.url,303);
    response.cookies.set(flowCookie,flow.state,{httpOnly:true,secure:true,sameSite:"lax",path:"/auth/telegram",maxAge:300});
    response.headers.set("Cache-Control","private, no-store");
    return response;
  }catch(error){
    if(error instanceof LoginError&&error.code==='authThrottled')failure=error.code;
    if(intent==="invite"&&error instanceof Error&&error.message==="Invite unavailable")failure="authTelegramInviteInvalid";
    if(wantsJson)return NextResponse.json({error:failure},{status:failure==='authThrottled'?429:failure==="authTelegramFailed"?503:400,headers:{"Cache-Control":"private, no-store"}});
    return NextResponse.redirect(new URL(intent==="link"?(failure==='authThrottled'?'/account?telegram=throttled':"/account?telegram=failed"):"/login?telegram=failed",origin),303);
  }
}
