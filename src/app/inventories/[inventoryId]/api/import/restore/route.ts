import { resolveInventory } from "@/items/inventories";
import { getDatabase,dataDirectory } from "@/db/client";
import { ArchiveError } from "@/export/archive";
import { ImportError, importArchiveAsNew } from "@/export/import";
import { rememberInventoryAction } from "@/app/inventory-actions";
import { InventoryBusyError } from "@/items/operation-lock";
import { z } from "zod";
import { readArchiveRequest } from "@/export/http";

export const runtime = "nodejs";

export async function POST(request: Request,{params}:{params:Promise<{inventoryId:string}>}) {
  try {
    const context=await resolveInventory((await params).inventoryId);
    const bytes = await readArchiveRequest(request);
    const name=decodeURIComponent(z.string().max(1500).parse(request.headers.get("x-all-items-inventory-name")));
    const result=await importArchiveAsNew(context,bytes,name,{client:(await getDatabase()).$client,directory:dataDirectory()});
    await rememberInventoryAction(result.inventoryId);
    return Response.json(result, { headers: { "Cache-Control": "no-store, private" } });
  } catch (error) {
    const key = error instanceof InventoryBusyError ? "inventoryBusy" : error instanceof ImportError && error.code === "occupied" ? "importOccupied"
      : error instanceof ArchiveError && error.message.startsWith("Unsupported archive format") ? "importUnsupported"
      : error instanceof ArchiveError || error instanceof ImportError && error.code === "invalid" ? "importInvalid" : "importFailed";
    return Response.json({ error: key }, { status: key === "importOccupied" ? 409 : key === "importFailed" ? 500 : 422, headers: { "Cache-Control": "no-store, private" } });
  }
}
