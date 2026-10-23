import { getLocale } from "@/i18n/server";
import { translate } from "@/i18n/messages";
import { ArchiveError } from "@/export/archive";
import { previewInventoryArchive } from "@/export/import";
import { readArchiveRequest } from "@/export/http";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const locale = await getLocale();
  try {
    const bytes = await readArchiveRequest(request);
    return Response.json(await previewInventoryArchive(bytes), { headers: { "Cache-Control": "no-store, private" } });
  } catch (error) {
    const unsupported = error instanceof ArchiveError && error.message.startsWith("Unsupported archive format");
    return Response.json({ error: translate(locale, unsupported ? "importUnsupported" : "importInvalid") }, { status: 422, headers: { "Cache-Control": "no-store, private" } });
  }
}
