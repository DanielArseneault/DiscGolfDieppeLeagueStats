import { prisma } from "@/lib/db";
import { Division, MemberStatus } from "@/generated/prisma/client";
import type { ParsedImport } from "@/lib/xlsx-parser";

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
    let player = result.username
      ? await prisma.player.findFirst({ where: { username: result.username, leagueId } })
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
    } else if (player.division !== result.division) {
      await prisma.player.update({
        where: { id: player.id },
        data: { division: result.division },
      });
    }

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
