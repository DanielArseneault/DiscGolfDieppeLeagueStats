import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/auth";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();

  const data: { excludeFromChampionship?: boolean; championshipPoolOverride?: string | null } = {};
  if (body.excludeFromChampionship !== undefined) data.excludeFromChampionship = body.excludeFromChampionship;
  if ("championshipPoolOverride" in body) data.championshipPoolOverride = body.championshipPoolOverride;

  const player = await prisma.player.update({
    where: { id: Number(id) },
    data,
  });

  return NextResponse.json(player);
}
