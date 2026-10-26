import { redirect } from "next/navigation";
import { preferredInventory } from "@/app/inventory-routing";
import { inventoryPath } from "@/items/inventory-context";
export const dynamic="force-dynamic";
export default async function Legacy() { const context=await preferredInventory(); redirect(context?inventoryPath(context,"/collections"):"/"); }
