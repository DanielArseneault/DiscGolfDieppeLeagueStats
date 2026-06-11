import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const round = await prisma.round.findUnique({
    where: { id: Number(id) },
    include: {
      results: {
        include: { player: true },
        orderBy: [{ division: "asc" }, { position: "asc" }],
      },
      ctpWinners: { orderBy: { hole: "asc" } },
      poolWinners: { orderBy: [{ pool: "asc" }, { place: "asc" }] },
      blueLayout: { include: { holePars: { orderBy: { holeNumber: "asc" } } } },
      redLayout: { include: { holePars: { orderBy: { holeNumber: "asc" } } } },
      post: true,
      newspaperImage: true,
    },
  });
  if (!round) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(round);
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();

  const round = await prisma.round.update({
    where: { id: Number(id) },
    data: {
      weekNumber: body.weekNumber,
      date: body.date ? new Date(body.date) : undefined,
      notes: body.notes,
    },
  });
  return NextResponse.json(round);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.round.delete({ where: { id: Number(id) } });
  return new NextResponse(null, { status: 204 });
}
