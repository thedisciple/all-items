"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
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
