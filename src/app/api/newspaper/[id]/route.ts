import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const image = await prisma.newspaperImage.findUnique({ where: { roundId: Number(id) } });
  return NextResponse.json(image);
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();

  const image = await prisma.newspaperImage.upsert({
    where: { roundId: Number(id) },
    create: {
      roundId: Number(id),
      headline: body.headline,
      dateline: body.dateline ?? null,
      bodyText: body.bodyText ?? null,
      photoUrls: body.photoUrls ?? [],
      caption: body.caption ?? null,
      closingText: body.closingText ?? null,
    },
    update: {
      headline: body.headline,
      dateline: body.dateline ?? null,
      bodyText: body.bodyText ?? null,
      photoUrls: body.photoUrls ?? [],
      caption: body.caption ?? null,
      closingText: body.closingText ?? null,
      generatedAt: body.markGenerated ? new Date() : undefined,
    },
  });
  return NextResponse.json(image);
}
