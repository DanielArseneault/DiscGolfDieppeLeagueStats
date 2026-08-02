import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/auth";
import { Division } from "@/generated/prisma/client";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const roundId = Number(id);

  const round = await prisma.round.findUnique({
    where: { id: roundId },
    include: { results: true },
  });
  if (!round) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (round.isDraft) {
    return NextResponse.json({ error: "Round is still a draft — finalize it before assigning tags" }, { status: 400 });
  }

  const assignments: { resultId: number; playerId: number; tagAfter: number }[] = [];

  for (const division of [Division.BLUE, Division.RED]) {
    const pool = round.results
      .filter((r) => r.division === division && r.tagBefore != null)
      .sort((a, b) => a.position - b.position);

    const tagNumbers = pool.map((r) => r.tagBefore!).sort((a, b) => a - b);

    pool.forEach((result, i) => {
      assignments.push({ resultId: result.id, playerId: result.playerId, tagAfter: tagNumbers[i] });
    });
  }

  await prisma.$transaction([
    ...assignments.map((a) =>
      prisma.result.update({ where: { id: a.resultId }, data: { tagAfter: a.tagAfter } })
    ),
    ...assignments.map((a) =>
      prisma.player.update({ where: { id: a.playerId }, data: { currentTag: a.tagAfter } })
    ),
  ]);

  const updated = await prisma.round.findUnique({
    where: { id: roundId },
    include: { results: { include: { player: true } } },
  });

  return NextResponse.json(updated);
}
