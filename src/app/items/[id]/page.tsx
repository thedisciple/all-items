import { redirect } from "next/navigation";
import { routeInventory } from "@/app/inventory-routing";
import { inventoryPath, ORIGINAL_INVENTORY_ID } from "@/items/inventory-context";
export const dynamic="force-dynamic";
export default async function Legacy({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{from?:string}>}) {
 const context=await routeInventory(ORIGINAL_INVENTORY_ID);
 const {id}=await params; const {from}=await searchParams;
 redirect(inventoryPath(context,`/items/${id}`)+(from?`?from=${encodeURIComponent(from)}`:""));
}
