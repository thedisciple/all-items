import { ORIGINAL_INVENTORY_ID } from "@/items/inventory-context";
import { resolveInventory } from "@/items/inventories";
import { createInventoryArchive } from "@/export/archive";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const context=await resolveInventory(ORIGINAL_INVENTORY_ID);
    const bytes = await createInventoryArchive(context);
    return new Response(bytes, { headers: { "Content-Type": "application/zip", "Content-Disposition": `attachment; filename="all-items-backup-${new Date().toISOString().slice(0, 10)}.zip"`, "Cache-Control": "no-store, private", "X-Content-Type-Options": "nosniff" } });
  } catch {
    return Response.json({ error: "exportArchiveFailed" }, { status: 500, headers: { "Cache-Control": "no-store, private" } });
  }
}
