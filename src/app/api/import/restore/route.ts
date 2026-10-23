import { getLocale } from "@/i18n/server";
import { translate } from "@/i18n/messages";
import { ArchiveError } from "@/export/archive";
import { ImportError, restoreInventoryArchive } from "@/export/import";
import { readArchiveRequest } from "@/export/http";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const locale = await getLocale();
  try {
    const bytes = await readArchiveRequest(request);
    await restoreInventoryArchive(bytes);
    return Response.json({ restored: true }, { headers: { "Cache-Control": "no-store, private" } });
  } catch (error) {
    const key = error instanceof ImportError && error.code === "occupied" ? "importOccupied"
      : error instanceof ArchiveError && error.message.startsWith("Unsupported archive format") ? "importUnsupported"
      : error instanceof ArchiveError || error instanceof ImportError && error.code === "invalid" ? "importInvalid" : "importFailed";
    return Response.json({ error: translate(locale, key) }, { status: key === "importOccupied" ? 409 : key === "importFailed" ? 500 : 422, headers: { "Cache-Control": "no-store, private" } });
  }
}
