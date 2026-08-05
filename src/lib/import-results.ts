import { prisma } from "@/lib/db";
import { Division } from "@/generated/prisma/client";
import type { ParsedImport } from "@/lib/xlsx-parser";
import { findOrCreatePlayer } from "@/lib/players";

export async function upsertResultsForRound(
  roundId: number,
  leagueId: number,
  parsed: ParsedImport
): Promise<{ blueCount: number; redCount: number }> {
  const allResults = [
    ...parsed.blueResults.map((r) => ({ ...r, division: Division.BLUE })),
    ...parsed.redResults.map((r) => ({ ...r, division: Division.RED })),
  ];

  for (const result of allResults) {
    const player = await findOrCreatePlayer(leagueId, result);

    await prisma.result.upsert({
      where: { roundId_playerId: { roundId, playerId: player.id } },
      create: {
        round: { connect: { id: roundId } },
        player: { connect: { id: player.id } },
        division: result.division,
        position: result.position,
        score: result.roundTotalScore,
        relativeScore: result.roundRelativeScore,
        holeScores: result.holeScores,
        tagBefore: player.currentTag,
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

  return { blueCount: parsed.blueResults.length, redCount: parsed.redResults.length };
}
