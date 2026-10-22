import { ZodError } from "zod";
import { readCollectionCover } from "@/media/collection-covers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ collectionId: string; mediaId: string }> };

export async function GET(request: Request, { params }: Context) {
  const { collectionId, mediaId } = await params;
  try {
    const variant = new URL(request.url).searchParams.get("variant");
    if (variant && variant !== "image" && variant !== "thumbnail") return new Response(null, { status: 400 });
    const photo = await readCollectionCover(collectionId, mediaId, variant !== "image");
    if (!photo) return new Response(null, { status: 404 });
    return new Response(new Uint8Array(photo), { status: 200, headers: {
      "Content-Type": "image/webp", "Content-Disposition": 'inline; filename="collection-cover.webp"',
      "Cache-Control": "private, no-store, max-age=0", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer",
    } });
  } catch (error) {
    return new Response(null, { status: error instanceof ZodError ? 400 : 404 });
  }
}
