import { getLocale } from "@/i18n/server";
import { translate } from "@/i18n/messages";
import { createInventoryArchive } from "@/export/archive";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const locale = await getLocale();
  try {
    const bytes = await createInventoryArchive();
    return new Response(bytes, { headers: { "Content-Type": "application/zip", "Content-Disposition": `attachment; filename="all-items-backup-${new Date().toISOString().slice(0, 10)}.zip"`, "Cache-Control": "no-store, private", "X-Content-Type-Options": "nosniff" } });
  } catch {
    return Response.json({ error: translate(locale, "exportArchiveFailed") }, { status: 500, headers: { "Cache-Control": "no-store, private" } });
  }
}
