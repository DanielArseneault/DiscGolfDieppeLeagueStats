import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/auth";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; checkInId: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: roundId, checkInId } = await params;

  const checkIn = await prisma.roundCheckIn.findUnique({ where: { id: Number(checkInId) } });
  if (!checkIn || checkIn.roundId !== Number(roundId)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.roundCheckIn.delete({ where: { id: Number(checkInId) } });

  return NextResponse.json({ ok: true });
}
