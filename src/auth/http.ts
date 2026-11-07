import {AccessError} from "./core";
import {validRequest} from "./policy";
export function assertMutationOrigin(request:Request){if(!validRequest(request.headers,true))throw new AccessError(403);}
export function accessFailure(error:unknown){return error instanceof AccessError?Response.json({error:error.status===404?"inventoryNotFound":"authUnavailable"},{status:error.status,headers:{"Cache-Control":"private, no-store"}}):null;}
