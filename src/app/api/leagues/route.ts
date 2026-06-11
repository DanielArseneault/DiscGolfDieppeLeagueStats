import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const leagues = await prisma.league.findMany({
    orderBy: { year: "desc" },
  });
  return NextResponse.json(leagues);
}

export async function POST(req: Request) {
  const body = await req.json();
  const league = await prisma.league.create({
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
  return NextResponse.json(league, { status: 201 });
}
