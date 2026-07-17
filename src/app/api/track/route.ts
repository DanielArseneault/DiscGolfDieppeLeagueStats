import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

const VISITOR_COOKIE = "dgl_visitor";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const path = body?.path;

  if (
    typeof path !== "string" ||
    !path.startsWith("/") ||
    path.startsWith("/admin") ||
    path.length > 255
  ) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const cookieStore = await cookies();
  const visitorId = cookieStore.get(VISITOR_COOKIE)?.value;
  if (!visitorId || visitorId.length > 100) {
    // No visitor cookie (e.g. cookies blocked) — nothing to attribute the view to.
    return new NextResponse(null, { status: 204 });
  }

  // The referrer field is only present on entry views (first view of a page
  // load). Store the external hostname, or "direct" when the visitor arrived
  // without one; client-side navigations (no field) store null.
  let referrer: string | null = null;
  if (typeof body?.referrer === "string") {
    referrer = "direct";
    try {
      const url = new URL(body.referrer);
      const selfHost = new URL(req.url).hostname;
      if (url.hostname && url.hostname !== selfHost && url.hostname.length <= 255) {
        referrer = url.hostname;
      }
    } catch {
      // unparseable/empty referrer — keep "direct"
    }
  }

  const userAgent = req.headers.get("user-agent") ?? "";
  const device = userAgent ? (/Mobi|Android|iPhone|iPad/i.test(userAgent) ? "mobile" : "desktop") : null;

  await prisma.pageView.create({ data: { path, visitorId, referrer, device } });

  return new NextResponse(null, { status: 204 });
}
