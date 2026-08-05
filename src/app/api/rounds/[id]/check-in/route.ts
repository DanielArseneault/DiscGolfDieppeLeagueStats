import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/auth";
import { Division, Gender, PaymentMethod } from "@/generated/prisma/client";
import { findOrCreatePlayer } from "@/lib/players";

interface CheckInUpdate {
  id: number;
  division?: Division;
  acePot?: boolean;
  paymentMethod?: PaymentMethod | null;
  paymentAmount?: number | null;
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const roundId = Number(id);
  const { playerId, name, division, gender } = (await req.json()) as {
    playerId?: number;
    name?: string;
    division: Division;
    gender?: Gender;
  };

  const round = await prisma.round.findUnique({ where: { id: roundId } });
  if (!round) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const player = playerId
    ? await prisma.player.findUnique({ where: { id: playerId } })
    : name?.trim()
    ? await findOrCreatePlayer(round.leagueId, { name: name.trim(), gender })
    : null;

  if (!player) return NextResponse.json({ error: "A player or name is required." }, { status: 400 });

  const checkIn = await prisma.roundCheckIn.upsert({
    where: { roundId_playerId: { roundId, playerId: player.id } },
    create: { roundId, playerId: player.id, division },
    update: { division },
    include: { player: true },
  });

  return NextResponse.json(checkIn);
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { checkIns } = (await req.json()) as { checkIns: CheckInUpdate[] };

  await prisma.$transaction(
    checkIns.map(({ id: checkInId, division, acePot, paymentMethod, paymentAmount }) =>
      prisma.roundCheckIn.update({
        where: { id: checkInId, roundId: Number(id) },
        data: {
          ...(division !== undefined ? { division } : {}),
          ...(acePot !== undefined ? { acePot } : {}),
          ...(paymentMethod !== undefined ? { paymentMethod } : {}),
          ...(paymentAmount !== undefined ? { paymentAmount } : {}),
        },
      })
    )
  );

  return NextResponse.json({ ok: true });
}
