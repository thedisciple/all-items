"use server";
import {assertActionOrigin} from "@/auth/request";
import {z} from "zod";
import {revalidatePath} from "next/cache";
import {dataDirectory} from "@/db/client";
import {inventoryDatabase} from "@/items/inventories";
import {createBackup,verifyBackup} from "@/backup/service";
import type {ActionFeedback} from "./actions";
import {requireAdmin} from "@/auth/authority";

export async function installationBackupAction(_previous:ActionFeedback,data:FormData):Promise<ActionFeedback>{
  await assertActionOrigin();
  try{await requireAdmin();const workspaceId=z.uuid().parse(data.get("inventoryId"));await inventoryDatabase({workspaceId});const operation=z.enum(["create","verify"]).parse(data.get("operation"));
    if(operation==="create")await createBackup(dataDirectory());else await verifyBackup(dataDirectory(),z.uuid().parse(data.get("backupId")));
    revalidatePath(`/inventories/${workspaceId}/data`);return {status:"success",message:"installationBackupSuccess"};
  }catch{return {status:"error",message:"installationBackupFailure"};}
}
