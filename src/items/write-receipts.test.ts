import {beforeAll,expect,it} from "vitest";
import {createClient} from "@libsql/client";
import {randomUUID} from "node:crypto";
import {mkdtemp} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {pathToFileURL} from "node:url";
import {applyMigrations} from "@/db/migrate";
import {createItem,deleteItem} from "./service";
import {insertWriteReceipt,readWriteReceipt,WriteReceiptConflict,WriteReceiptDeleted,type WriteIdentity} from "./write-receipts";

const context={workspaceId:"00000000-0000-4000-8000-000000000001"};
let client:ReturnType<typeof createClient>;
beforeAll(async()=>{
  const directory=await mkdtemp(path.join(os.tmpdir(),"all-items-write-receipts-"));process.env.ALL_ITEMS_DATA_DIR=directory;
  client=createClient({url:pathToFileURL(path.join(directory,"all-items.db")).href});
  await applyMigrations(client,path.join(process.cwd(),"src/db/migrations"));
  await applyMigrations(client,path.join(process.cwd(),"src/db/migrations"));
});
const identity=():WriteIdentity=>({operationId:randomUUID(),kind:"item_create",requestHash:"a".repeat(64)});

it("recovers concurrent and acknowledgement retries without allocating another number",async()=>{
  const receipt=identity();
  const before=Number((await client.execute({sql:"SELECT next_inventory_number FROM workspaces WHERE id=?",args:[context.workspaceId]})).rows[0]!.next_inventory_number);
  const results=await Promise.all([0,1,2].map(()=>createItem(context,{name:"Synthetic acknowledged creation"},undefined,undefined,{id:randomUUID(),identity:receipt})));
  expect(new Set(results.map(item=>item.id)).size).toBe(1);
  expect(new Set(results.map(item=>item.inventoryNumber)).size).toBe(1);
  expect(Number((await client.execute({sql:"SELECT next_inventory_number FROM workspaces WHERE id=?",args:[context.workspaceId]})).rows[0]!.next_inventory_number)).toBe(before+1);
  expect(await readWriteReceipt(client,context,receipt)).toMatchObject({itemId:results[0]!.id});
});

it("rejects changed completed content and scopes operation identities by inventory",async()=>{
  const receipt=identity();const item=await createItem(context,{name:"Synthetic bound content"},undefined,undefined,{id:randomUUID(),identity:receipt});
  await expect(createItem(context,{name:"Changed content"},undefined,undefined,{id:randomUUID(),identity:{...receipt,requestHash:"b".repeat(64)}})).rejects.toBeInstanceOf(WriteReceiptConflict);
  const foreign={workspaceId:randomUUID()};await client.execute({sql:"INSERT INTO workspaces(id,name,created_at) VALUES(?,?,?)",args:[foreign.workspaceId,"Synthetic receipt isolation",new Date().toISOString()]});
  expect(await readWriteReceipt(client,foreign,receipt)).toBeNull();
  const other=await createItem(foreign,{name:"Synthetic independent receipt"},undefined,undefined,{id:randomUUID(),identity:receipt});expect(other.id).not.toBe(item.id);
  await expect(insertWriteReceipt(client,foreign,{...receipt,operationId:randomUUID()},{itemId:item.id,mediaId:null,inventoryNumber:item.inventoryNumber})).rejects.toThrow("Invalid write receipt ownership");
});

it("retains deletion tombstones and rejects result or identity rewrites",async()=>{
  const receipt=identity();const item=await createItem(context,{name:"Synthetic deleted receipt"},undefined,undefined,{id:randomUUID(),identity:receipt});
  await expect(client.execute({sql:"UPDATE item_write_receipts SET request_hash=? WHERE workspace_id=? AND operation_id=?",args:["b".repeat(64),context.workspaceId,receipt.operationId]})).rejects.toThrow("immutable");
  await deleteItem(context,item.id);
  expect((await client.execute({sql:"SELECT item_id FROM item_write_receipts WHERE workspace_id=? AND operation_id=?",args:[context.workspaceId,receipt.operationId]})).rows[0]!.item_id).toBeNull();
  await expect(createItem(context,{name:"Synthetic deleted receipt"},undefined,undefined,{id:randomUUID(),identity:receipt})).rejects.toBeInstanceOf(WriteReceiptDeleted);
  const replacement=await createItem(context,{name:"Synthetic unrelated surviving item"});
  await expect(client.execute({sql:"UPDATE item_write_receipts SET item_id=? WHERE workspace_id=? AND operation_id=?",args:[replacement.id,context.workspaceId,receipt.operationId]})).rejects.toThrow("immutable");
  expect((await client.execute("PRAGMA foreign_key_check")).rows).toHaveLength(0);
});
