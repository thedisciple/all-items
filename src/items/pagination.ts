import {z} from "zod";

const positive=z.preprocess(value=>typeof value==="string"&&/^\d{1,7}$/.test(value)?Number(value):value,z.number().int().min(1).max(1_000_000)).catch(1);
const size=z.preprocess(value=>typeof value==="string"&&/^\d{2,3}$/.test(value)?Number(value):value,z.union([z.literal(25),z.literal(50),z.literal(100)])).catch(25);
export function paginationInput(value:{page?:unknown;pageSize?:unknown}={}){return z.object({page:positive,pageSize:size}).parse(value);}
export type PageResult<T>={items:T[];total:number;page:number;pageSize:number;pages:number};

export function listRouteQuery(value:unknown){
  const raw=z.object({q:z.string().trim().max(160).catch(""),category:z.string().trim().max(80).catch(""),status:z.enum(["unknown","user_confirmed","source_verified"]).optional().catch(undefined),sort:z.enum(["date","name","quantity"]).optional().catch(undefined),page:z.unknown().optional(),pageSize:z.unknown().optional(),added:z.string().uuid().optional().catch(undefined),updated:z.string().uuid().optional().catch(undefined)}).parse(value);
  return{...raw,...paginationInput(raw)};
}
