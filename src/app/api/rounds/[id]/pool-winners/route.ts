import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();

  await prisma.championshipPoolWinner.deleteMany({ where: { roundId: Number(id) } });

  if (body.poolWinners?.length > 0) {
    await prisma.championshipPoolWinner.createMany({
      data: body.poolWinners.map((w: { pool: string; place: number; playerName: string }) => ({
        roundId: Number(id),
        pool: w.pool,
        place: w.place,
        playerName: w.playerName,
      })),
    });
  }

  return NextResponse.json({ ok: true });
}
