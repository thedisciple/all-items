import {z} from 'zod';
import {inventoryDatabase} from './inventories';
import type {InventoryContext} from './inventory-context';
import {itemRevision,StaleItemReview} from './review';

export const citationUrl=z.string().trim().max(2048).url().refine(value=>{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password;});
export const citationSchema=z.object({version:z.literal(1),url:citationUrl,label:z.string().trim().min(1).max(160),match:z.string().trim().min(1).max(1000),locator:z.string().trim().max(160),brand:z.string().max(120),model:z.string().max(160),marking:z.string().max(160),reviewedAt:z.iso.datetime()}).strict();
export type Citation=z.infer<typeof citationSchema>;
export function validateEvidenceRecord(row:Record<string,unknown>){
  if(row.source_evidence==null)return;
  const citation=citationSchema.parse(JSON.parse(z.string().max(12000).parse(row.source_evidence)));
  if(row.identification_status!=='source_verified'||citation.brand!==(row.brand??'')||citation.model!==(row.model??'')||citation.marking!==(row.original_marking??''))throw new Error('Evidence does not match saved identity');
}
export const evidenceInput=z.object({revision:z.string().regex(/^[a-f0-9]{64}$/),remove:z.boolean().default(false),confirm:z.literal(true).optional(),url:citationUrl.optional(),label:z.string().trim().min(1).max(160).optional(),match:z.string().trim().min(1).max(1000).optional(),locator:z.string().trim().max(160).default(''),brand:z.string().trim().max(120).default(''),model:z.string().trim().max(160).default(''),description:z.string().trim().max(4000).optional()}).strict();
export async function readEvidence(context:InventoryContext,id:string){const {db,workspaceId}=await inventoryDatabase(context);z.uuid().parse(id);const row=(await db.$client.execute({sql:'SELECT source_evidence FROM items WHERE id=? AND workspace_id=?',args:[id,workspaceId]})).rows[0];return row?.source_evidence?citationSchema.parse(JSON.parse(String(row.source_evidence))):null;}
export async function saveEvidence(context:InventoryContext,id:string,value:unknown){
  z.uuid().parse(id);const input=evidenceInput.parse(value),{db,workspaceId}=await inventoryDatabase(context),tx=await db.$client.transaction('write');
  try{
    if(await itemRevision(tx,id,workspaceId)!==input.revision)throw new StaleItemReview();
    const row=(await tx.execute({sql:'SELECT * FROM items WHERE id=? AND workspace_id=?',args:[id,workspaceId]})).rows[0]!;
    if(input.remove){await tx.execute({sql:"UPDATE items SET source_evidence=NULL,identification_status=CASE WHEN source_evidence IS NOT NULL THEN 'user_confirmed' ELSE identification_status END,updated_at=? WHERE id=? AND workspace_id=?",args:[new Date().toISOString(),id,workspaceId]});}
    else{
      if(input.confirm!==true)throw new Error('Explicit source confirmation required');
      const citation=citationSchema.parse({version:1,url:input.url,label:input.label,match:input.match,locator:input.locator,brand:input.brand,model:input.model,marking:String(row.original_marking??''),reviewedAt:new Date().toISOString()});
      // Identity trigger invalidates the old citation first; attach this newly confirmed snapshot afterwards.
      await tx.execute({sql:'UPDATE items SET brand=?,model=?,description=?,updated_at=? WHERE id=? AND workspace_id=?',args:[input.brand||null,input.model||null,input.description??row.description,new Date().toISOString(),id,workspaceId]});
      await tx.execute({sql:"UPDATE items SET source_evidence=?,identification_status='source_verified' WHERE id=? AND workspace_id=?",args:[JSON.stringify(citation),id,workspaceId]});
    }await tx.commit();
  }catch(error){await tx.rollback();throw error;}
}
