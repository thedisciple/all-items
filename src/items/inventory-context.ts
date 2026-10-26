import { z } from "zod";

export const ORIGINAL_INVENTORY_ID = "00000000-0000-4000-8000-000000000001";
export const inventoryContextSchema = z.object({ workspaceId: z.uuid() });
export type InventoryContext = Readonly<z.infer<typeof inventoryContextSchema>>;

export function inventoryPath(context: InventoryContext, suffix = "") {
  return `/inventories/${inventoryContextSchema.parse(context).workspaceId}${suffix}`;
}

export function inventoryReturnPath(context: InventoryContext, value: unknown) {
  const root = inventoryPath(context);
  const route = z.string().parse(value);
  if (route === root) return route;
  const collectionId = route.startsWith(`${root}/collections/`) ? route.slice(`${root}/collections/`.length) : "";
  if (z.uuid().safeParse(collectionId).success) return route;
  throw new Error("Invalid inventory return route");
}
