import {vi} from "vitest";
// Existing domain regression fixtures model a verified original-owner request.
// Security tests unmock this module and exercise real cookie/session verification.
vi.mock("@/auth/request",()=>({assertActionOrigin:async()=>{},requestUser:async()=>({id:"00000000-0000-4000-8000-000000000010",username:"synthetic-owner",isAdmin:true})}));
