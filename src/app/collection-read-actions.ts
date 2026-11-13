"use server";
import {z} from "zod";
import {assertActionOrigin} from "@/auth/request";
import {resolveInventory} from "@/items/inventories";
import {getCollection,collectionCoverPage} from "@/items/collections";
import {listItemsPage} from "@/items/service";
import {getLocale} from "@/i18n/server";
import {translate} from "@/i18n/messages";

const input=z.object({inventoryId:z.string().uuid(),collectionId:z.string().uuid(),query:z.string().trim().max(160),page:z.number().int().min(1).max(1_000_000)});
// Both reads authorize the actor before querying; no browser preference grants access.
export async function collectionCandidates(value:unknown){
  await assertActionOrigin();
  const parsed=input.parse(value),context=await resolveInventory(parsed.inventoryId);
  if(!await getCollection(context,parsed.collectionId))throw new Error("Collection unavailable");
  const result=await listItemsPage(context,{search:parsed.query,unnamedLabel:translate(await getLocale(),"unidentifiedItemName"),sort:"name",excludeCollectionId:parsed.collectionId},{page:parsed.page});
  return{...result,items:result.items.map(item=>({id:String(item.id),name:String(item.name),model:item.model==null?null:String(item.model),categories:item.categories,mediaId:item.primary_media_id==null?null:String(item.primary_media_id)}))};
}
export async function collectionPhotos(value:unknown){
  await assertActionOrigin();
  const parsed=input.parse(value),context=await resolveInventory(parsed.inventoryId);
  if(!await getCollection(context,parsed.collectionId))throw new Error("Collection unavailable");
  return collectionCoverPage(context,parsed.collectionId,parsed.query,parsed.page);
}
