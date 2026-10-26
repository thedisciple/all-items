import { resolveInventory } from "@/items/inventories";
import { getDatabase,dataDirectory } from "@/db/client";
import { ArchiveError } from "@/export/archive";
import { ImportError, restoreInventoryArchive } from "@/export/import";
import { readArchiveRequest } from "@/export/http";

export const runtime = "nodejs";

export async function POST(request: Request,{params}:{params:Promise<{inventoryId:string}>}) {
  try {
    const context=await resolveInventory((await params).inventoryId);
    const bytes = await readArchiveRequest(request);
    await restoreInventoryArchive(bytes,{client:(await getDatabase()).$client,directory:dataDirectory(),workspaceId:context.workspaceId});
    return Response.json({ restored: true }, { headers: { "Cache-Control": "no-store, private" } });
  } catch (error) {
    const key = error instanceof ImportError && error.code === "occupied" ? "importOccupied"
      : error instanceof ArchiveError && error.message.startsWith("Unsupported archive format") ? "importUnsupported"
      : error instanceof ArchiveError || error instanceof ImportError && error.code === "invalid" ? "importInvalid" : "importFailed";
    return Response.json({ error: key }, { status: key === "importOccupied" ? 409 : key === "importFailed" ? 500 : 422, headers: { "Cache-Control": "no-store, private" } });
  }
}
