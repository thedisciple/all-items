import {NextResponse,type NextRequest} from "next/server";
import {validRequest} from "./auth/policy";

export function middleware(request:NextRequest){
  // Private images use controlled routes directly; never create a shared optimizer cache.
  if(request.nextUrl.pathname==="/_next/image")return new NextResponse(null,{status:404,headers:{"Cache-Control":"private, no-store"}});
  if(!validRequest(request.headers,!["GET","HEAD","OPTIONS"].includes(request.method)))return new NextResponse(null,{status:403,headers:{"Cache-Control":"private, no-store"}});
  const response=NextResponse.next();
  response.headers.set("Cache-Control","private, no-store");
  response.headers.set("X-Content-Type-Options","nosniff");
  response.headers.set("Referrer-Policy","same-origin");
  response.headers.set("X-Frame-Options","DENY");
  response.headers.set("Cross-Origin-Resource-Policy","same-origin");
  response.headers.set("Permissions-Policy","camera=(self), microphone=(), geolocation=()");
  // Keep Next's inline hydration and the local photo editor functional; restrict
  // framing, form targets, external images and plugin content without a broad CSP.
  response.headers.set("Content-Security-Policy","object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'; img-src 'self' data: blob:");
  return response;
}
export const config={runtime:"nodejs",matcher:["/((?!_next/static|favicon.svg).*)"]};
