import {POST as SOURCE} from "@/app/inventories/[inventoryId]/items/[id]/source/route";
import {beforeAll,afterAll,it,expect,vi} from 'vitest';
import {mkdtemp,writeFile,unlink} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import sharp from 'sharp';
vi.unmock('@/auth/request');
const request=vi.hoisted(()=>({token:'',headers:new Headers({host:'127.0.0.1:3000',origin:'http://127.0.0.1:3000'})}));
vi.mock('next/headers',()=>({cookies:async()=>({get:()=>({value:request.token})}),headers:async()=>request.headers}));
vi.mock('next/cache',()=>({revalidatePath:()=>{}}));
import {getDatabase} from '@/db/client';
import {applyMigrations} from '@/db/migrate';
import {provisionAccount,signIn} from '@/auth/core';
import {createInventory} from '@/items/inventories';
import {getItem,getItemRevision,updateItem} from '@/items/service';
import {createItemWithPhoto,listItemPhotos} from '@/media/service';
import {createCollection,addItemToCollection,listItemCollections} from '@/items/collections';
import {identifyItem} from './service';
import {POST,PATCH} from '@/app/inventories/[inventoryId]/items/[id]/identify/route';
let directory:string,client:Awaited<ReturnType<typeof getDatabase>>['$client'],a:string,b:string,inventory:{workspaceId:string},id:string,photoId:string,calls=0;
const fake={model:'synthetic',identify:async({images}: {images:Buffer[]})=>{calls++;const metadata=await sharp(images[0]).metadata();expect(metadata.exif).toBeUndefined();expect(metadata.width).toBeLessThanOrEqual(1024);return{version:1 as const,name:'Suggested name',brand:'Suggested brand',model:'',categories:['tools' as const],description:'Visible tool',visibleMarking:'Untrusted label',uncertainty:'uncertain' as const,uncertainties:[]};}};
beforeAll(async()=>{directory=await mkdtemp(path.join(os.tmpdir(),'all-items-ai-'));process.env.ALL_ITEMS_DATA_DIR=directory;process.env.ALL_ITEMS_ORIGIN='http://127.0.0.1:3000';client=(await getDatabase()).$client;await applyMigrations(client,path.join(process.cwd(),'src/db/migrations'));await provisionAccount(client,'ai-owner','Synthetic owner password',true);await provisionAccount(client,'ai-other','Synthetic other password');a=(await signIn(client,directory,'ai-owner','Synthetic owner password')).token;b=(await signIn(client,directory,'ai-other','Synthetic other password')).token;request.token=a;inventory=await createInventory('Synthetic AI inventory');const image=await sharp({create:{width:1400,height:500,channels:3,background:'#466655'}}).withExif({IFD0:{Artist:'Synthetic metadata'}}).png().toBuffer();const item=await createItemWithPhoto(inventory,{name:'Human name',brand:'Human brand',categories:['Custom'],originalMarking:'Original marking',identificationStatus:'user_confirmed',saleIntent:'considering'},new File([new Uint8Array(image)],'synthetic.png',{type:'image/png'}));id=item.id;photoId=(await listItemPhotos(inventory,id))[0]!.id;});
afterAll(()=>client.close());
it('authorizes selected saved media before inference, normalizes input, and never silently saves',async()=>{
  const before=await getItem(inventory,id),proposal=await identifyItem(inventory,id,'synthetic-owner',{photoIds:[photoId]},fake,new AbortController().signal);expect(proposal.provenance).toMatchObject({model:'synthetic',photoIds:[photoId],basedOn:'image_only'});expect(await getItem(inventory,id)).toEqual(before);expect(calls).toBe(1);
  await expect(identifyItem(inventory,id,'synthetic-owner',{photoIds:[crypto.randomUUID()]},fake,new AbortController().signal)).rejects.toThrow();await expect(identifyItem(inventory,id,'synthetic-owner',{photoIds:[photoId],url:'http://foreign.invalid'},fake,new AbortController().signal)).rejects.toThrow();expect(calls).toBe(1);
  request.token=b;await expect(identifyItem(inventory,id,'other',{photoIds:[photoId]},fake,new AbortController().signal)).rejects.toThrow();expect(calls).toBe(1);request.token=a;
});
it('applies selected fields atomically through the shared save and preserves unrelated metadata/categories/stock/photos',async()=>{
  const collection=await createCollection(inventory,{name:'Preserved membership'});await addItemToCollection(inventory,collection.id,id);const memberships=await listItemCollections(inventory,id);
  const before=(await getItem(inventory,id))!,photos=await listItemPhotos(inventory,id),revision=await getItemRevision(inventory,id);
  await updateItem(inventory,id,{name:''},undefined,{revision,patch:{model:'Explicitly reviewed model',categories:['tools','electronics']}});
  const after=(await getItem(inventory,id))!;expect(after).toMatchObject({name:before.name,brand:before.brand,model:'Explicitly reviewed model',original_marking:before.original_marking,identification_status:before.identification_status,sale_intent:before.sale_intent,stock:before.stock,asking_price_minor:before.asking_price_minor,asking_price_exponent:before.asking_price_exponent});expect(after.categories).toEqual(expect.arrayContaining(['Custom','tools','electronics']));expect(await listItemPhotos(inventory,id)).toEqual(photos);expect(await listItemCollections(inventory,id)).toEqual(memberships);
  await expect(updateItem(inventory,id,{name:''},undefined,{revision,patch:{name:'Repeated response'}})).rejects.toThrow('changed');expect((await getItem(inventory,id))!.name).toBe(before.name);
});
it('refuses stale/concurrent changes and fields that could promote verification or alter stock',async()=>{
  const revision=await getItemRevision(inventory,id);await updateItem(inventory,id,{name:'New human edit'});
  await expect(updateItem(inventory,id,{name:''},undefined,{revision,patch:{name:'Stale overwrite'}})).rejects.toThrow('changed');
  await expect(updateItem(inventory,id,{name:''},undefined,{revision:await getItemRevision(inventory,id),patch:{identificationStatus:'source_verified'} as never})).rejects.toThrow();expect((await getItem(inventory,id))!.name).toBe('New human edit');
});
it('rejects saturation and cancellation and releases the private lock on failure',async()=>{
  await writeFile(path.join(directory,'.ai-inference.lock'),'synthetic-other-process');await expect(identifyItem(inventory,id,'synthetic-owner',{photoIds:[photoId]},fake,new AbortController().signal)).rejects.toMatchObject({key:'aiBusy'});await unlink(path.join(directory,'.ai-inference.lock'));
  const abort=new AbortController();abort.abort();await expect(identifyItem(inventory,id,'synthetic-owner',{photoIds:[photoId]},fake,abort.signal)).rejects.toMatchObject({key:'aiCancelled'});
});
it('protects the exact inference/apply HTTP routes from missing sessions, foreign inventories and hostile origins',async()=>{
  const params={params:Promise.resolve({inventoryId:inventory.workspaceId,id})},headers={host:'127.0.0.1:3000',origin:'http://127.0.0.1:3000','content-type':'application/json'};
  request.token='';expect((await SOURCE(new Request('http://127.0.0.1:3000/test',{method:'POST',headers,body:'{}'}),params)).status).toBe(401);expect((await POST(new Request('http://127.0.0.1:3000/test',{method:'POST',headers,body:'{}'}),params)).status).toBe(401);
  request.token=b;expect((await SOURCE(new Request('http://127.0.0.1:3000/test',{method:'POST',headers,body:'{}'}),params)).status).toBe(404);expect((await PATCH(new Request('http://127.0.0.1:3000/test',{method:'PATCH',headers,body:'{}'}),params)).status).toBe(404);
  request.token=a;expect((await SOURCE(new Request('http://127.0.0.1:3000/test',{method:'POST',headers:{...headers,origin:'https://attacker.invalid'},body:'{}'}),params)).status).toBe(403);expect((await POST(new Request('http://127.0.0.1:3000/test',{method:'POST',headers:{...headers,origin:'https://attacker.invalid'},body:'{}'}),params)).status).toBe(403);
});
it('persists the per-user throttle and refuses work before provider invocation',async()=>{
  const {createHash}=await import('node:crypto');await client.execute({sql:'INSERT INTO auth_login_buckets(bucket,started_at,attempts) VALUES(?,?,6) ON CONFLICT(bucket) DO UPDATE SET attempts=6,started_at=excluded.started_at',args:['ai:'+createHash('sha256').update('synthetic-owner').digest('hex'),Date.now()]});const before=calls;
  await expect(identifyItem(inventory,id,'synthetic-owner',{photoIds:[photoId]},fake,new AbortController().signal)).rejects.toMatchObject({key:'aiBusy'});expect(calls).toBe(before);
});
