import {createHash} from 'node:crypto';
import {z} from 'zod';
import type {Client} from '@libsql/client';
import {categories} from './categories';

export const reviewedPatch=z.object({name:z.string().trim().min(1).max(160).optional(),brand:z.string().trim().max(120).optional(),model:z.string().trim().max(160).optional(),description:z.string().trim().max(4000).optional(),categories:z.array(z.enum(categories)).max(11).optional()}).strict().refine(value=>Object.keys(value).length>0);
export type ReviewedPatch=z.infer<typeof reviewedPatch>;
export class StaleItemReview extends Error{constructor(){super('Item changed; review again');}}
export async function itemRevision(client:Pick<Client,'execute'>,id:string,workspaceId:string){
  const item=await client.execute({sql:'SELECT * FROM items WHERE id=? AND workspace_id=?',args:[id,workspaceId]});if(!item.rows.length)throw new StaleItemReview();
  const result=[];for(const sql of['SELECT category FROM item_categories WHERE item_id=? ORDER BY category','SELECT id,location_id,quantity,updated_at FROM stock_entries WHERE item_id=? ORDER BY id','SELECT id,storage_path,display_order,is_primary FROM media_assets WHERE item_id=? ORDER BY id'])result.push((await client.execute({sql,args:[id]})).rows);
  return createHash('sha256').update(JSON.stringify([item.rows,result])).digest('hex');
}
