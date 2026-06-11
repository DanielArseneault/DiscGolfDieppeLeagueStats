import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();

  await prisma.ctpWinner.deleteMany({ where: { roundId: Number(id) } });

  const winners = await prisma.ctpWinner.createMany({
    data: body.ctpWinners.map((w: { hole: number; playerName: string }) => ({
      roundId: Number(id),
      hole: w.hole,
      playerName: w.playerName,
    })),
  });
  return NextResponse.json(winners);
}
