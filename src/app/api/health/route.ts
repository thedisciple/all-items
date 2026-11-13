import {NextResponse} from "next/server";
import metadata from "../../../../package.json";
export const dynamic="force-dynamic";
// No database access or identity data. Normal exact-origin middleware still applies.
export function GET(){const value=process.env.ALL_ITEMS_RELEASE_SHA;return NextResponse.json({status:"ok",version:metadata.version,revision:value&&/^[a-f0-9]{40}$/.test(value)?value:null},{headers:{"Cache-Control":"no-store"}});}
