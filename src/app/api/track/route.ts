import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const path = body?.path;
  const visitorId = body?.visitorId;

  if (
    typeof path !== "string" ||
    typeof visitorId !== "string" ||
    !path.startsWith("/") ||
    path.length > 255 ||
    visitorId.length > 100
  ) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  await prisma.pageView.create({ data: { path, visitorId } });

  return new NextResponse(null, { status: 204 });
}
