import {z} from "zod";
import {getDatabase} from "@/db/client";
import {requireActor} from "@/auth/authority";

// Legacy bookmarks resolve through ownership, never the selected-inventory cookie.
export async function ownedLegacyInventory(kind:"item"|"collection",value:unknown){
  const id=z.uuid().safeParse(value);if(!id.success)return null;
  const actor=await requireActor(),db=(await getDatabase()).$client;
  const table=kind==="item"?"items":"collections";
  const row=(await db.execute({sql:`SELECT e.workspace_id FROM ${table} e JOIN inventory_owners o ON o.workspace_id=e.workspace_id WHERE e.id=? AND o.user_id=?`,args:[id.data,actor.id]})).rows[0];
  return row?{workspaceId:String(row.workspace_id)}:null;
}
