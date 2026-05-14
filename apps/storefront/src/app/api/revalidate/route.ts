import { revalidateTag } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";

/**
 * On-demand revalidation endpoint. Called by the ShopFlow API after webhook
 * events (product/stock/price updates) to invalidate the corresponding ISR
 * cache tags. Requires a shared secret to prevent abuse.
 *
 * POST /api/revalidate
 *   headers: x-revalidate-secret
 *   body: { tags: string[] }
 */
export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-revalidate-secret");
  if (!secret || secret !== process.env.REVALIDATE_SECRET) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  let body: { tags?: string[] };
  try {
    body = (await req.json()) as { tags?: string[] };
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const tags = Array.isArray(body.tags) ? body.tags : [];
  for (const tag of tags) {
    revalidateTag(tag);
  }

  return NextResponse.json({ ok: true, revalidated: tags });
}
