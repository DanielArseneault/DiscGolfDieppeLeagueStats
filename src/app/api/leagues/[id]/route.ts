import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const league = await prisma.league.findUnique({ where: { id: Number(id) } });
  if (!league) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(league);
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const league = await prisma.league.update({
    where: { id: Number(id) },
    data: {
      name: body.name,
      year: body.year,
      location: body.location,
      startDate: new Date(body.startDate),
      endDate: new Date(body.endDate),
      qualifyingWeeks: body.qualifyingWeeks ?? 9,
      bestScoresCount: body.bestScoresCount ?? 5,
      minWeeks: body.minWeeks ?? 5,
    },
  });
  return NextResponse.json(league);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const roundCount = await prisma.round.count({ where: { leagueId: Number(id) } });
  if (roundCount > 0) {
    return NextResponse.json(
      { error: "Cannot delete a league that has rounds. Delete all rounds first." },
      { status: 409 }
    );
  }
  await prisma.league.delete({ where: { id: Number(id) } });
  return new NextResponse(null, { status: 204 });
}
