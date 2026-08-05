import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/auth";
import { parseUDiscParticipants } from "@/lib/udisc-participants";
import { findOrCreatePlayer } from "@/lib/players";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const roundId = Number(id);

  const round = await prisma.round.findUnique({ where: { id: roundId } });
  if (!round) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!round.udiscUrl) {
    return NextResponse.json({ error: "This round has no UDisc URL set." }, { status: 400 });
  }

  const participantsUrl = `${round.udiscUrl.replace(/\/+$/, "")}/participants`;

  let res: Response;
  try {
    res = await fetch(participantsUrl, {
      signal: AbortSignal.timeout(15000),
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
      },
    });
  } catch {
    return NextResponse.json({ error: "Could not reach UDisc. Try again in a moment." }, { status: 502 });
  }

  if (!res.ok) {
    return NextResponse.json(
      { error: `UDisc returned an error (status ${res.status}). Check the event URL is correct.` },
      { status: 502 }
    );
  }

  let participants;
  try {
    const html = await res.text();
    participants = parseUDiscParticipants(html);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Failed to parse UDisc participants page: ${msg}` }, { status: 400 });
  }

  let blueCount = 0;
  let redCount = 0;
  try {
    for (const p of participants) {
      const player = await findOrCreatePlayer(round.leagueId, p);
      await prisma.roundCheckIn.upsert({
        where: { roundId_playerId: { roundId, playerId: player.id } },
        create: { roundId, playerId: player.id, division: p.division },
        update: { division: p.division },
      });
      if (p.division === "BLUE") blueCount++;
      else redCount++;
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("UDisc participants sync DB error:", msg);
    return NextResponse.json({ error: `Database error: ${msg}` }, { status: 500 });
  }

  return NextResponse.json({ blueCount, redCount, syncedAt: new Date().toISOString() });
}
