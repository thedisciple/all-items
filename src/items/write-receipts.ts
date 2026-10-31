import type { Client } from "@libsql/client";
import { z } from "zod";
import type { InventoryContext } from "./inventory-context";

const identitySchema=z.object({operationId:z.uuid(),kind:z.enum(["item_create","photo_add","photo_replace"]),requestHash:z.string().regex(/^[a-f0-9]{64}$/)});
export type WriteIdentity=z.infer<typeof identitySchema>;
export type WriteResult={itemId:string;mediaId:string|null;inventoryNumber:string};
type Executor=Pick<Client,"execute">;

export class WriteReceiptConflict extends Error {
  constructor(public readonly itemId:string|null){super("This operation already completed with different content");}
}
export class WriteReceiptDeleted extends Error {
  constructor(public readonly itemId:string|null){super("This operation completed but its result was deleted");}
}

export async function readWriteReceipt(executor:Executor,context:InventoryContext,identity:WriteIdentity):Promise<WriteResult|null>{
  const {operationId,kind,requestHash}=identitySchema.parse(identity);
  const workspaceId=z.uuid().parse(context.workspaceId);
  const result=await executor.execute({sql:"SELECT kind,request_hash,item_id,media_id,inventory_number FROM item_write_receipts WHERE workspace_id=? AND operation_id=?",args:[workspaceId,operationId]});
  const row=result.rows[0];if(!row)return null;
  const itemId=row.item_id===null?null:String(row.item_id);
  if(row.kind!==kind||row.request_hash!==requestHash)throw new WriteReceiptConflict(itemId);
  if(!itemId||(kind!=="item_create"&&row.media_id===null))throw new WriteReceiptDeleted(itemId);
  return{itemId,mediaId:row.media_id===null?null:String(row.media_id),inventoryNumber:String(row.inventory_number)};
}

export async function insertWriteReceipt(executor:Executor,context:InventoryContext,identity:WriteIdentity,result:WriteResult){
  const parsed=identitySchema.parse(identity);
  z.uuid().parse(context.workspaceId);z.uuid().parse(result.itemId);if(result.mediaId)z.uuid().parse(result.mediaId);
  await executor.execute({sql:"INSERT INTO item_write_receipts(workspace_id,operation_id,kind,request_hash,item_id,media_id,inventory_number,created_at) VALUES(?,?,?,?,?,?,?,?)",args:[context.workspaceId,parsed.operationId,parsed.kind,parsed.requestHash,result.itemId,result.mediaId,result.inventoryNumber,new Date().toISOString()]});
}
