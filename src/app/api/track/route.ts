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

  await prisma.pageView.create({ data: { path, visitorId } });

  return new NextResponse(null, { status: 204 });
}
