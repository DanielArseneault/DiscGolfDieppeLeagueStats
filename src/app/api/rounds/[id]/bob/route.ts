import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/auth";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { playerName } = await req.json();

  const bobTag = await prisma.bobTag.upsert({
    where: { roundId: Number(id) },
    create: { roundId: Number(id), playerName },
    update: { playerName },
  });

  return NextResponse.json(bobTag);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  await prisma.bobTag.deleteMany({ where: { roundId: Number(id) } });
  return new NextResponse(null, { status: 204 });
}
