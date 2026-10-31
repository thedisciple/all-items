"use server";

import {z} from "zod";
import {revalidatePath} from "next/cache";
import {resolveInventory} from "@/items/inventories";
import {inventoryPath} from "@/items/inventory-context";
import {creationCommandSchema} from "@/items/creation-command";
import {CreationStageError,finalizeItemCreation,stageItemCreation} from "@/items/creation";
import {WriteReceiptConflict,WriteReceiptDeleted} from "@/items/write-receipts";
import {MediaProcessingBusy,MediaValidationError} from "@/media/service";
import type {ActionFeedback} from "./actions";

export type CreationFeedback=ActionFeedback&{ready?:boolean;completedOperation?:boolean};
const fileSchema=z.custom<File>(value=>value instanceof File).refine(file=>file.size>0&&file.size<=10*1024*1024);
function failure(error:unknown,final=false):CreationFeedback{
  if(error instanceof WriteReceiptConflict)return{status:"error",message:"creationAlreadySaved",itemId:error.itemId??undefined,completedOperation:true};
  if(error instanceof WriteReceiptDeleted)return{status:"error",message:"creationResultDeleted",itemId:error.itemId??undefined,completedOperation:true};
  if(error instanceof MediaProcessingBusy)return{status:"error",message:"photoProcessingBusy"};
  if(error instanceof MediaValidationError)return{status:"error",message:"invalidPhoto"};
  if(error instanceof CreationStageError&&error.code==="capacity")return{status:"error",message:"creationPreparationLimit"};
  return{status:"error",message:final?"creationAcknowledgementFailed":"creationPhotosFailed"};
}
function command(form:FormData){return creationCommandSchema.parse(JSON.parse(z.string().max(64*1024).parse(form.get("command"))));}

export async function stageCreationPhotoAction(form:FormData):Promise<CreationFeedback>{
  const context=await resolveInventory(form.get("inventoryId")).catch(()=>null);if(!context)return{status:"error",message:"inventoryNotFound"};
  try{
    const value=command(form),photoId=z.uuid().parse(form.get("photoId")),file=fileSchema.parse(form.get("photo"));
    const source=form.get("photoSource"),result=await stageItemCreation(context,value,photoId,file,source===null?file:fileSchema.parse(source));
    if("completed"in result){revalidatePath(inventoryPath(context),"layout");return{status:"success",message:"itemAdded",itemId:result.completed.itemId};}
    return{status:"success",message:"",ready:true};
  }catch(error){return failure(error);}
}

export async function finalizeCreationAction(form:FormData):Promise<CreationFeedback>{
  const context=await resolveInventory(form.get("inventoryId")).catch(()=>null);if(!context)return{status:"error",message:"inventoryNotFound"};
  try{
    const result=await finalizeItemCreation(context,command(form));revalidatePath(inventoryPath(context),"layout");
    return{status:"success",message:"itemAdded",itemId:result.itemId};
  }catch(error){return failure(error,true);}
}
