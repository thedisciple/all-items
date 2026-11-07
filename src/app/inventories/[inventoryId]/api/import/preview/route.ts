import {accessFailure,assertMutationOrigin} from "@/auth/http";
import { resolveInventory } from "@/items/inventories";
import { ArchiveError } from "@/export/archive";
import { previewInventoryArchive } from "@/export/import";
import { readArchiveRequest } from "@/export/http";

export const runtime = "nodejs";

export async function POST(request: Request,{params}:{params:Promise<{inventoryId:string}>}) {
  try {
    assertMutationOrigin(request);
    await resolveInventory((await params).inventoryId);
    const bytes = await readArchiveRequest(request);
    return Response.json(await previewInventoryArchive(bytes), { headers: { "Cache-Control": "no-store, private" } });
  } catch (error) {
    const denied=accessFailure(error);if(denied)return denied;
    const unsupported = error instanceof ArchiveError && error.message.startsWith("Unsupported archive format");
    return Response.json({ error: unsupported ? "importUnsupported" : "importInvalid" }, { status: 422, headers: { "Cache-Control": "no-store, private" } });
  }
}
