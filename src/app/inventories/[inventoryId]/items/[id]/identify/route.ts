import {z} from 'zod';
import {assertMutationOrigin,accessFailure} from '@/auth/http';
import {requestUser} from '@/auth/request';
import {resolveInventory} from '@/items/inventories';
import {getItem,updateItem} from '@/items/service';
import {reviewedPatch,StaleItemReview} from '@/items/review';
import {aiConfiguration} from '@/ai/config';
import {identifyItem} from '@/ai/service';
import {OllamaProvider} from '@/ai/ollama';
import {IdentificationError} from '@/ai/contracts';
import {revalidatePath} from 'next/cache';

export const runtime='nodejs';
export const dynamic='force-dynamic';
type Context={params:Promise<{inventoryId:string;id:string}>};
async function body(request:Request){
  if(!request.body)throw new IdentificationError('aiInvalid');const reader=request.body.getReader(),chunks:Uint8Array[]=[];let size=0;
  try{while(true){const chunk=await reader.read();if(chunk.done)break;size+=chunk.value.length;if(size>8192)throw new IdentificationError('aiInvalid');chunks.push(chunk.value);}return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;}finally{await reader.cancel().catch(()=>{});}
}
function response(value:unknown,status=200){return Response.json(value,{status,headers:{'Cache-Control':'private, no-store'}});}
async function handle(request:Request,context:Context,apply:boolean){
  try{
    assertMutationOrigin(request);const user=await requestUser(),{inventoryId,id}=await context.params,inventory=await resolveInventory(inventoryId);z.uuid().parse(id);
    if(!await getItem(inventory,id))return response({error:'aiInvalid'},404);
    const config=aiConfiguration();if(!config)throw new IdentificationError();
    const input=await body(request);
    if(!apply){z.object({revision:z.string().regex(/^[a-f0-9]{64}$/)}).passthrough().parse(input);return response(await identifyItem(inventory,id,user.id,input,new OllamaProvider(config.model),request.signal));}
    const review=z.object({revision:z.string().regex(/^[a-f0-9]{64}$/),patch:reviewedPatch}).strict().parse(input);
    await updateItem(inventory,id,{name:''},undefined,review);revalidatePath(`/inventories/${inventoryId}`);const item=await getItem(inventory,id);if(!item)throw new StaleItemReview();return response({ok:true,values:{name:item.name,brand:item.brand??'',model:item.model??'',description:item.description??'',categories:item.categories}});
  }catch(error){const denied=accessFailure(error);if(denied)return denied;if(error instanceof StaleItemReview)return response({error:'aiStale'},409);if(error instanceof IdentificationError)return response({error:error.key},error.key==='aiBusy'?429:error.key==='aiStale'?409:error.key==='aiInvalid'?400:503);return response({error:'aiInvalid'},400);}
}
export async function POST(request:Request,context:Context){return handle(request,context,false);}
export async function PATCH(request:Request,context:Context){return handle(request,context,true);}
