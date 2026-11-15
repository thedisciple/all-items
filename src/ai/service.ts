import 'server-only';
import sharp from 'sharp';
import {open,unlink} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {dataDirectory} from '@/db/client';
import {inventoryDatabase} from '@/items/inventories';
import {getItem,getItemRevision} from '@/items/service';
import type {InventoryContext} from '@/items/inventory-context';
import {readPrimaryPhoto} from '@/media/service';
import {assertPrivatePath} from '@/media/private-paths';
import {IdentificationError,identifyInput,suggestionSchema,type IdentificationProvider,type Proposal} from './contracts';

async function reserveBudget(context:InventoryContext,userId:string){
  const {db}=await inventoryDatabase(context),tx=await db.$client.transaction('write'),now=Date.now();
  try{await tx.execute({sql:'DELETE FROM auth_login_buckets WHERE started_at<=?',args:[now-15*60000]});for(const [key,limit]of[['ai:installation',12],['ai:'+createHash('sha256').update(userId).digest('hex'),6]] as const){const row=(await tx.execute({sql:'SELECT attempts FROM auth_login_buckets WHERE bucket=?',args:[key]})).rows[0];if(row&&Number(row.attempts)>=limit)throw new IdentificationError('aiBusy');await tx.execute({sql:'INSERT INTO auth_login_buckets(bucket,started_at,attempts) VALUES(?,?,1) ON CONFLICT(bucket) DO UPDATE SET attempts=attempts+1',args:[key,now]});}await tx.commit();}catch(error){await tx.rollback();throw error;}
}
export async function identifyItem(context:InventoryContext,itemId:string,userId:string,value:unknown,provider:IdentificationProvider,signal:AbortSignal):Promise<Proposal>{
  const input=identifyInput.parse(value),item=await getItem(context,itemId);if(!item)throw new IdentificationError('aiInvalid');
  const file=path.join(dataDirectory(),'.ai-inference.lock');await assertPrivatePath(dataDirectory(),file);
  let lock;try{lock=await open(file,'wx',0o600);}catch{throw new IdentificationError('aiBusy');}
  try{
    await lock.writeFile(String(process.pid));await lock.sync();const revision=await getItemRevision(context,itemId),images:Buffer[]=[];
    if(input.revision&&input.revision!==revision)throw new IdentificationError('aiStale');
    const snapshot=await getItem(context,itemId);if(!snapshot||await getItemRevision(context,itemId)!==revision)throw new IdentificationError('aiStale');
    if(signal.aborted)throw new IdentificationError('aiCancelled');
    const {db,workspaceId}=await inventoryDatabase(context),selected=await db.$client.execute({sql:`SELECT m.id FROM media_assets m JOIN items i ON i.id=m.item_id WHERE i.id=? AND i.workspace_id=? AND m.id IN (${input.photoIds.map(()=>'?').join(',')})`,args:[itemId,workspaceId,...input.photoIds]});if(selected.rows.length!==input.photoIds.length)throw new IdentificationError('aiInvalid');
    // Reserve before file reads/decoding too, so rejected requests cannot repeatedly burn CPU.
    await reserveBudget(context,userId);
    // Authorization and identifier checks precede any provider call. No drafts, source paths or URLs.
    for(const id of input.photoIds){if(signal.aborted)throw new IdentificationError('aiCancelled');const photo=await readPrimaryPhoto(context,itemId,id,'image',10*1024*1024);if(!photo)throw new IdentificationError('aiInvalid');const image=await sharp(photo,{limitInputPixels:40000000}).rotate().resize({width:1024,height:1024,fit:'inside',withoutEnlargement:true}).jpeg({quality:80}).toBuffer();if(image.length>512*1024)throw new IdentificationError('aiInvalid');images.push(image);}
    const suggestion=suggestionSchema.parse(await provider.identify({images,locale:input.locale,signal,context:input.includeContext?{brand:(snapshot.brand??'').slice(0,120),model:(snapshot.model??'').slice(0,160),marking:(snapshot.original_marking??'').slice(0,160)}:undefined}));
    if(signal.aborted)throw new IdentificationError('aiCancelled');
    return{suggestion,revision,provenance:{provider:'ollama',model:provider.model,photoIds:input.photoIds,generatedAt:new Date().toISOString(),basedOn:input.includeContext?'image_and_context':'image_only'}};
  }finally{await lock.close();await unlink(file);}
}
