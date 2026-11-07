import "server-only";
import {cookies,headers} from "next/headers";
import {redirect} from "next/navigation";
import {AccessError,SESSION_COOKIE,sessionUser} from "./core";
import {validRequest} from "./policy";

export async function currentUser(touch=false){
  const incoming=await headers();if(!validRequest(incoming,Boolean(incoming.get("next-action"))))throw new AccessError(403);
  return sessionUser((await cookies()).get(SESSION_COOKIE)?.value,undefined,undefined,Date.now(),touch);
}
export async function requestUser(){const user=await currentUser();if(!user)throw new AccessError(401);return user;}
export async function assertActionOrigin(){if(!validRequest(await headers(),true))throw new AccessError(403);}
export async function pageUser(){const user=await currentUser(true);if(!user)redirect("/login");return user;}
