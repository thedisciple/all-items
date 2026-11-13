import { z } from "zod";
import {listRouteQuery} from "./pagination";

export const ORIGINAL_INVENTORY_ID = "00000000-0000-4000-8000-000000000001";
export const inventoryContextSchema = z.object({ workspaceId: z.uuid() });
export type InventoryContext = Readonly<z.infer<typeof inventoryContextSchema>>;

export function inventoryPath(context: InventoryContext, suffix = "") {
  return `/inventories/${inventoryContextSchema.parse(context).workspaceId}${suffix}`;
}

export function inventoryReturnPath(context: InventoryContext, value: unknown) {
  const root = inventoryPath(context);
  const input=z.string().max(2048).parse(value),[route,query]=input.split("?");
  if(input.includes("#")||input.split("?").length>2)throw new Error("Invalid inventory return route");
  const collectionId = route.startsWith(`${root}/collections/`) ? route.slice(`${root}/collections/`.length) : "";
  if(route!==root&&!z.uuid().safeParse(collectionId).success)throw new Error("Invalid inventory return route");
  if(!query)return route;
  const params=new URLSearchParams(query),allowed=["q","category","status","sort","page","pageSize"];
  for(const key of params.keys())if(!allowed.includes(key)||params.getAll(key).length!==1)throw new Error("Invalid inventory return query");
  const parsed=listRouteQuery(Object.fromEntries(params)),safe=new URLSearchParams();
  for(const key of allowed){const entry=parsed[key as keyof typeof parsed];if(params.has(key)&&entry!==undefined&&entry!=="")safe.set(key,String(entry));}
  return route+(safe.size?"?"+safe:"");
}
