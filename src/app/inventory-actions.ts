"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { deleteInventory,InventoryDeletionError } from "@/items/inventory-deletion";
import { InventoryBusyError } from "@/items/operation-lock";
import { preferredInventory } from "@/app/inventory-routing";
import { createInventory, renameInventory, resolveInventory } from "@/items/inventories";
import { inventoryPath } from "@/items/inventory-context";
import type { MessageKey } from "@/i18n/messages";

export type InventoryFeedback = { status: "idle" | "success" | "error"; code?: MessageKey; inventoryId?: string };

export async function rememberInventoryAction(id: string) {
  const context = await resolveInventory(id);
  (await cookies()).set("all-items-inventory", context.workspaceId, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 365 });
}

export async function createInventoryAction(_previous: InventoryFeedback, data: FormData): Promise<InventoryFeedback> {
  try {
    const inventory = await createInventory(data.get("name"));
    await rememberInventoryAction(inventory.workspaceId);
    revalidatePath("/", "layout");
    return { status: "success", inventoryId: inventory.workspaceId };
  } catch { return { status: "error", code: "inventoryCreateFailed" }; }
}

export async function renameInventoryAction(_previous: InventoryFeedback, data: FormData): Promise<InventoryFeedback> {
  try {
    const context = await resolveInventory(data.get("inventoryId"));
    await renameInventory(context, data.get("name"));
    revalidatePath(inventoryPath(context), "layout");
    return { status: "success" };
  } catch { return { status: "error", code: "inventoryRenameFailed" }; }
}

export async function deleteInventoryAction(_previous:InventoryFeedback,data:FormData):Promise<InventoryFeedback> {
  try {
    z.literal("on").parse(data.get("confirm"));
    const context=await resolveInventory(data.get("inventoryId"));
    await deleteInventory(context,data.get("confirmation")??"");
  }catch(error){
    const code:MessageKey=error instanceof InventoryBusyError?"inventoryBusy":error instanceof InventoryDeletionError?error.code==="confirmation"?"inventoryDeleteName":error.code==="changed"?"inventoryChanged":"inventoryNotFound":"inventoryDeleteFailed";
    // Another tab may have renamed or populated the target while confirmation was open.
    const target=z.uuid().safeParse(data.get("inventoryId"));
    if(target.success&&error instanceof InventoryDeletionError&&error.code!=="not_found") revalidatePath(inventoryPath({workspaceId:target.data}),"layout");
    return {status:"error",code};
  }
  const remaining=await preferredInventory();
  if(remaining)await rememberInventoryAction(remaining.workspaceId);
  else (await cookies()).delete("all-items-inventory");
  revalidatePath("/","layout");
  redirect(remaining?inventoryPath(remaining):"/");
}
