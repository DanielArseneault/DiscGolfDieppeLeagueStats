import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/auth";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; resultId: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: roundId, resultId } = await params;
  const { holeScores } = (await req.json()) as { holeScores: Record<string, number> };

  const round = await prisma.round.findUnique({
    where: { id: Number(roundId) },
    include: {
      blueLayout: { include: { holePars: true } },
      redLayout: { include: { holePars: true } },
    },
  });
  if (!round) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const result = await prisma.result.findUnique({ where: { id: Number(resultId) } });
  if (!result || result.roundId !== Number(roundId)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Filter out zero/invalid scores
  const filledScores: Record<string, number> = {};
  for (const [hole, score] of Object.entries(holeScores)) {
    const s = Number(score);
    if (s > 0) filledScores[hole] = s;
  }

  const score = Object.values(filledScores).reduce((s, v) => s + v, 0);

  const layout = result.division === "BLUE" ? round.blueLayout : round.redLayout;
  const relativeScore = layout?.holePars?.length
    ? score - layout.holePars.reduce((s, h) => s + h.par, 0)
    : score;

  await prisma.result.update({
    where: { id: Number(resultId) },
    data: { holeScores: filledScores, score, relativeScore },
  });

  // Recalculate positions for all results in this round + division
  const divResults = await prisma.result.findMany({
    where: { roundId: Number(roundId), division: result.division },
    orderBy: { score: "asc" },
  });

  let pos = 1;
  for (let i = 0; i < divResults.length; i++) {
    if (i > 0 && divResults[i].score !== divResults[i - 1].score) {
      pos = i + 1;
    }
    await prisma.result.update({
      where: { id: divResults[i].id },
      data: { position: pos },
    });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; resultId: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: roundId, resultId } = await params;

  const result = await prisma.result.findUnique({ where: { id: Number(resultId) } });
  if (!result || result.roundId !== Number(roundId)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.result.delete({ where: { id: Number(resultId) } });

  // Recalculate positions for the remaining results in this round + division
  const divResults = await prisma.result.findMany({
    where: { roundId: Number(roundId), division: result.division },
    orderBy: { score: "asc" },
  });

  let pos = 1;
  for (let i = 0; i < divResults.length; i++) {
    if (i > 0 && divResults[i].score !== divResults[i - 1].score) {
      pos = i + 1;
    }
    await prisma.result.update({
      where: { id: divResults[i].id },
      data: { position: pos },
    });
  }

  return NextResponse.json({ ok: true });
}
