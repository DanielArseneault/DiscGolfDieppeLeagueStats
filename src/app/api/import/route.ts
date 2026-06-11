import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { parseUDiscFile } from "@/lib/xlsx-parser";
import { Division, MemberStatus } from "@/generated/prisma/client";

export async function POST(req: Request) {
  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const leagueId = Number(formData.get("leagueId") ?? 1);
  const weekNumber = Number(formData.get("weekNumber"));
  const date = formData.get("date") as string;
  const blueLayoutId = formData.get("blueLayoutId") ? Number(formData.get("blueLayoutId")) : null;
  const redLayoutId = formData.get("redLayoutId") ? Number(formData.get("redLayoutId")) : null;
  const isChampionship = formData.get("isChampionship") === "true";

  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });
  if (!weekNumber || !date) return NextResponse.json({ error: "weekNumber and date required" }, { status: 400 });

  let parsed;
  try {
    const buffer = await file.arrayBuffer();
    parsed = parseUDiscFile(buffer);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Failed to parse file: ${msg}` }, { status: 400 });
  }

  if (parsed.blueResults.length === 0 && parsed.redResults.length === 0) {
    return NextResponse.json(
      { error: "No results found. Check that the file has Blue/Red sheet names and correct column names." },
      { status: 400 }
    );
  }

  try {
    const round = await prisma.round.upsert({
      where: { leagueId_weekNumber: { leagueId, weekNumber } },
      create: { leagueId, weekNumber, date: new Date(date), blueLayoutId, redLayoutId, isChampionship },
      update: { date: new Date(date), blueLayoutId, redLayoutId, isChampionship },
    });

    const allResults = [
      ...parsed.blueResults.map((r) => ({ ...r, division: Division.BLUE })),
      ...parsed.redResults.map((r) => ({ ...r, division: Division.RED })),
    ];

    for (const result of allResults) {
      let player = result.username
        ? await prisma.player.findUnique({ where: { username: result.username } })
        : await prisma.player.findFirst({ where: { name: result.name, leagueId } });

      if (!player) {
        player = await prisma.player.create({
          data: {
            name: result.name,
            pdgaNumber: result.pdgaNumber,
            username: result.username,
            division: result.division,
            memberStatus: MemberStatus.NON_MEMBER,
            league: { connect: { id: leagueId } },
          },
        });
      }

      await prisma.result.upsert({
        where: { roundId_playerId: { roundId: round.id, playerId: player.id } },
        create: {
          round: { connect: { id: round.id } },
          player: { connect: { id: player.id } },
          division: result.division,
          position: result.position,
          score: result.roundTotalScore,
          relativeScore: result.roundRelativeScore,
          holeScores: result.holeScores,
        },
        update: {
          division: result.division,
          position: result.position,
          score: result.roundTotalScore,
          relativeScore: result.roundRelativeScore,
          holeScores: result.holeScores,
        },
      });
    }

    return NextResponse.json({
      roundId: round.id,
      weekNumber,
      blueCount: parsed.blueResults.length,
      redCount: parsed.redResults.length,
      inferredBluePar: parsed.inferredBluePar,
      inferredRedPar: parsed.inferredRedPar,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Import DB error:", msg);
    return NextResponse.json({ error: `Database error: ${msg}` }, { status: 500 });
  }
}
