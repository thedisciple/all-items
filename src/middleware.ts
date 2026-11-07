import {NextResponse,type NextRequest} from "next/server";
import {validRequest} from "./auth/policy";

export function middleware(request:NextRequest){
  // Private images use controlled routes directly; never create a shared optimizer cache.
  if(request.nextUrl.pathname==="/_next/image")return new NextResponse(null,{status:404,headers:{"Cache-Control":"private, no-store"}});
  if(!validRequest(request.headers,!["GET","HEAD","OPTIONS"].includes(request.method)))return new NextResponse(null,{status:403,headers:{"Cache-Control":"private, no-store"}});
  const response=NextResponse.next();response.headers.set("Cache-Control","private, no-store");response.headers.set("X-Content-Type-Options","nosniff");response.headers.set("Referrer-Policy","same-origin");response.headers.set("X-Frame-Options","DENY");return response;
}
export const config={matcher:["/((?!_next/static|favicon.svg).*)"]};
