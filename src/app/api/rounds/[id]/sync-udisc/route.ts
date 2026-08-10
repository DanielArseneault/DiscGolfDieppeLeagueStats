import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { parseUDiscFile } from "@/lib/xlsx-parser";
import { parseUDiscParticipants } from "@/lib/udisc-participants-parser";
import { upsertResultsForRound, upsertCheckInsFromParticipants } from "@/lib/import-results";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const roundId = Number(id);

  const round = await prisma.round.findUnique({ where: { id: roundId } });
  if (!round) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!round.udiscUrl) {
    return NextResponse.json({ error: "This round has no UDisc URL set." }, { status: 400 });
  }

  const baseUrl = round.udiscUrl.replace(/\/+$/, "");
  const exportUrl = `${baseUrl}/leaderboard/export`;

  let res: Response;
  try {
    res = await fetch(exportUrl, { signal: AbortSignal.timeout(15000) });
  } catch {
    return NextResponse.json({ error: "Could not reach UDisc. Try again in a moment." }, { status: 502 });
  }

  if (!res.ok) {
    return NextResponse.json(
      { error: `UDisc returned an error (status ${res.status}). Check the event URL is correct.` },
      { status: 502 }
    );
  }

  let parsed;
  try {
    const buffer = await res.arrayBuffer();
    parsed = parseUDiscFile(buffer);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Failed to parse UDisc export: ${msg}` }, { status: 400 });
  }

  if (parsed.blueResults.length === 0 && parsed.redResults.length === 0) {
    // No leaderboard rows usually means the round hasn't started yet. Fall
    // back to the participants list so check-in/payment tracking can be
    // filled in before anyone posts a score.
    const participants = await fetchParticipants(baseUrl);

    if (participants.length === 0) {
      return NextResponse.json({
        blueCheckIns: 0,
        redCheckIns: 0,
        blueScores: 0,
        redScores: 0,
        message: "No players checked in yet on UDisc.",
      });
    }

    try {
      const { blueCheckIns, redCheckIns } = await upsertCheckInsFromParticipants(
        round.id,
        round.leagueId,
        participants
      );
      return NextResponse.json({
        blueCheckIns,
        redCheckIns,
        blueScores: 0,
        redScores: 0,
        syncedAt: new Date().toISOString(),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("UDisc participants sync DB error:", msg);
      return NextResponse.json({ error: `Database error: ${msg}` }, { status: 500 });
    }
  }

  try {
    const { blueCheckIns, redCheckIns, blueScores, redScores } = await upsertResultsForRound(
      round.id,
      round.leagueId,
      parsed
    );
    return NextResponse.json({
      blueCheckIns,
      redCheckIns,
      blueScores,
      redScores,
      inferredBluePar: parsed.inferredBluePar,
      inferredRedPar: parsed.inferredRedPar,
      syncedAt: new Date().toISOString(),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("UDisc sync DB error:", msg);
    return NextResponse.json({ error: `Database error: ${msg}` }, { status: 500 });
  }
}

async function fetchParticipants(baseUrl: string) {
  try {
    const res = await fetch(`${baseUrl}/participants`, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) return [];
    const html = await res.text();
    return parseUDiscParticipants(html);
  } catch {
    return [];
  }
}
