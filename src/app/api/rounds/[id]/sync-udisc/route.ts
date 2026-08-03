import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { parseUDiscFile } from "@/lib/xlsx-parser";
import { upsertResultsForRound } from "@/lib/import-results";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const roundId = Number(id);

  const round = await prisma.round.findUnique({ where: { id: roundId } });
  if (!round) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!round.udiscUrl) {
    return NextResponse.json({ error: "This round has no UDisc URL set." }, { status: 400 });
  }

  const exportUrl = `${round.udiscUrl.replace(/\/+$/, "")}/leaderboard/export`;

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
    return NextResponse.json({
      blueCount: 0,
      redCount: 0,
      message: "No scores posted yet on UDisc.",
    });
  }

  try {
    const { blueCount, redCount } = await upsertResultsForRound(round.id, round.leagueId, parsed);
    return NextResponse.json({
      blueCount,
      redCount,
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
