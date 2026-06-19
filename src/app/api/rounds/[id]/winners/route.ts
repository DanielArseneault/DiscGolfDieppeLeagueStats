import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { Division } from "@/generated/prisma/client";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();

  await prisma.roundWinner.deleteMany({ where: { roundId: Number(id) } });

  if (body.roundWinners?.length) {
    await prisma.roundWinner.createMany({
      data: body.roundWinners.map((w: { division: string; place: number; playerName: string; prize?: string }) => ({
        roundId: Number(id),
        division: w.division as Division,
        place: w.place,
        playerName: w.playerName,
        prize: w.prize || null,
      })),
    });
  }

  return NextResponse.json({ ok: true });
}
