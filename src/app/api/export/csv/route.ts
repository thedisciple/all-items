import { getLocale } from "@/i18n/server";
import { translate } from "@/i18n/messages";
import { createInventoryCsv } from "@/export/archive";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const locale = await getLocale();
  try {
    const bytes = await createInventoryCsv();
    return new Response(bytes, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="all-items-inventory-${new Date().toISOString().slice(0, 10)}.csv"`, "Cache-Control": "no-store, private", "X-Content-Type-Options": "nosniff" } });
  } catch {
    return Response.json({ error: translate(locale, "exportCsvFailed") }, { status: 500, headers: { "Cache-Control": "no-store, private" } });
  }
}
