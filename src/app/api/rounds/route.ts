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
