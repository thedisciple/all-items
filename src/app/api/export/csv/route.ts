import { ORIGINAL_INVENTORY_ID } from "@/items/inventory-context";
import { resolveInventory } from "@/items/inventories";
import { createInventoryCsv } from "@/export/archive";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const context=await resolveInventory(ORIGINAL_INVENTORY_ID);
    const bytes = await createInventoryCsv(context);
    return new Response(bytes, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="all-items-inventory-${new Date().toISOString().slice(0, 10)}.csv"`, "Cache-Control": "no-store, private", "X-Content-Type-Options": "nosniff" } });
  } catch {
    return Response.json({ error: "exportCsvFailed" }, { status: 500, headers: { "Cache-Control": "no-store, private" } });
  }
}
