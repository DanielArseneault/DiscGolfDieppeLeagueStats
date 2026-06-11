import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const post = await prisma.post.findUnique({ where: { roundId: Number(id) } });
  return NextResponse.json(post);
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();

  const post = await prisma.post.upsert({
    where: { roundId: Number(id) },
    create: { roundId: Number(id), content: body.content },
    update: { content: body.content },
  });
  return NextResponse.json(post);
}
