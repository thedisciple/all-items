import { resolveInventory } from "@/items/inventories";
import { ZodError } from "zod";
import { readPrimaryPhoto } from "@/media/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ inventoryId:string; itemId: string; mediaId: string }> };

export async function GET(request: Request, { params }: Context) {
  const { itemId, mediaId, inventoryId } = await params;
  try {
    const context=await resolveInventory(inventoryId);
    const photo = await readPrimaryPhoto(context,itemId, mediaId, new URL(request.url).searchParams.get("variant"));
    if (!photo) return new Response(null, { status: 404 });
    return new Response(new Uint8Array(photo), {
      status: 200,
      headers: {
        "Content-Type": "image/webp",
        "Content-Disposition": 'inline; filename="photo.webp"',
        "Cache-Control": "private, no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "no-referrer",
      },
    });
  } catch (error) {
    const status = error instanceof ZodError ? 400 : 404;
    return new Response(null, { status });
  }
}
