import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { ZodError } from "zod";
import { listInventories, resolveInventory } from "@/items/inventories";
import { ORIGINAL_INVENTORY_ID } from "@/items/inventory-context";
import {AccessError} from "@/auth/core";
import {redirect} from "next/navigation";

export async function routeInventory(id: unknown) {
  try { return await resolveInventory(id); }
  catch(error) { if(error instanceof AccessError){if(error.status===401)redirect("/login");notFound();} if (error instanceof ZodError || error instanceof Error && error.message === "Inventory not found") notFound(); throw error; }
}

export async function preferredInventory() {
  await (await import("@/auth/request")).pageUser();
  const inventories = await listInventories();
  const preference = (await cookies()).get("all-items-inventory")?.value;
  return inventories.find(entry => entry.workspaceId === preference) ?? inventories.find(entry => entry.workspaceId === ORIGINAL_INVENTORY_ID) ?? inventories[0] ?? null;
}
