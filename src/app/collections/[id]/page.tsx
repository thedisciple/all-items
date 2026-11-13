import { redirect } from "next/navigation";
import { routeInventory } from "@/app/inventory-routing";
import { inventoryPath } from "@/items/inventory-context";
import {ownedLegacyInventory} from "@/items/legacy-routes";
import {pageUser} from "@/auth/request";
import {notFound} from "next/navigation";
export const dynamic="force-dynamic";
export default async function Legacy({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{from?:string}>}) {
 const {id}=await params; const {from}=await searchParams;
 await pageUser();const owned=await ownedLegacyInventory("collection",id);if(!owned)notFound();const context=await routeInventory(owned.workspaceId);
 redirect(inventoryPath(context,`/collections/${id}`)+(from?`?from=${encodeURIComponent(from)}`:""));
}
