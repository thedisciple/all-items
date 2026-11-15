import {assertMutationOrigin,accessFailure} from '@/auth/http';
import {resolveInventory} from '@/items/inventories';
import {saveEvidence} from '@/items/source-evidence';
import {StaleItemReview} from '@/items/review';
import {revalidatePath} from 'next/cache';
export const runtime='nodejs';
export async function POST(request:Request,{params}:{params:Promise<{inventoryId:string;id:string}>}){
  try{assertMutationOrigin(request);const {inventoryId,id}=await params,context=await resolveInventory(inventoryId);if(Number(request.headers.get('content-length'))>12000)return new Response(null,{status:413});if(!request.body)return new Response(null,{status:400});const reader=request.body.getReader(),chunks:Uint8Array[]=[];let size=0;try{while(true){const value=await reader.read();if(value.done)break;size+=value.value.byteLength;if(size>12000)return new Response(null,{status:413});chunks.push(value.value);}}finally{await reader.cancel().catch(()=>{});}const text=Buffer.concat(chunks).toString("utf8");await saveEvidence(context,id,JSON.parse(text));revalidatePath(`/inventories/${inventoryId}`);return Response.json({ok:true},{headers:{'Cache-Control':'no-store'}});}catch(error){return accessFailure(error)??Response.json({error:error instanceof StaleItemReview?'aiStale':'operationFailed'},{status:error instanceof StaleItemReview?409:400,headers:{'Cache-Control':'no-store'}});}
}
