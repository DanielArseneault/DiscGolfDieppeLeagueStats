import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const leagueId = Number(searchParams.get("leagueId") ?? 1);

  const rounds = await prisma.round.findMany({
    where: { leagueId },
    orderBy: { weekNumber: "asc" },
    include: {
      _count: { select: { results: true } },
      ctpWinners: true,
    },
  });
  return NextResponse.json(rounds);
}

export async function POST(req: Request) {
  const body = await req.json();
  const leagueId = Number(body.leagueId ?? 1);
  const weekNumber = Number(body.weekNumber);
  const date = body.date as string;
  const blueLayoutId = body.blueLayoutId ? Number(body.blueLayoutId) : null;
  const redLayoutId = body.redLayoutId ? Number(body.redLayoutId) : null;
  const isChampionship = body.isChampionship === true;
  const udiscUrl = (body.udiscUrl as string | undefined)?.trim() || null;

  if (!weekNumber || !date) {
    return NextResponse.json({ error: "weekNumber and date required" }, { status: 400 });
  }
  if (!udiscUrl) {
    return NextResponse.json({ error: "udiscUrl required" }, { status: 400 });
  }

  const round = await prisma.round.upsert({
    where: { leagueId_weekNumber: { leagueId, weekNumber } },
    create: { leagueId, weekNumber, date: new Date(date), blueLayoutId, redLayoutId, isChampionship, isDraft: true, udiscUrl },
    update: { date: new Date(date), blueLayoutId, redLayoutId, isChampionship, udiscUrl },
  });

  return NextResponse.json(round);
}
