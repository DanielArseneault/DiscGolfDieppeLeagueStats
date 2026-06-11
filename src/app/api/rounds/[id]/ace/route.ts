import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();

  await prisma.aceWinner.deleteMany({ where: { roundId: Number(id) } });

  const winners = await prisma.aceWinner.createMany({
    data: body.aceWinners.map((w: { hole: number; playerName: string; prizeAmount?: number }) => ({
      roundId: Number(id),
      hole: w.hole,
      playerName: w.playerName,
      prizeAmount: w.prizeAmount ?? null,
    })),
  });
  return NextResponse.json(winners);
}
