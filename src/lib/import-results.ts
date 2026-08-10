import { prisma } from "@/lib/db";
import { Division } from "@/generated/prisma/client";
import type { ParsedImport } from "@/lib/xlsx-parser";
import type { ParsedParticipant } from "@/lib/udisc-participants-parser";
import { findOrCreatePlayer } from "@/lib/players";

/** Upserts a check-in, seeding tagBefore from the player's last known tag
 *  (i.e. last week's tagAfter) so the check-in tab starts pre-filled. Never
 *  overwrites a tagBefore that's already saved on the check-in, whether from
 *  a manual edit or an earlier sync. */
async function upsertCheckIn(
  roundId: number,
  player: { id: number; currentTag: string | null },
  division: Division
) {
  const existing = await prisma.roundCheckIn.findUnique({
    where: { roundId_playerId: { roundId, playerId: player.id } },
  });

  if (!existing) {
    return prisma.roundCheckIn.create({
      data: { roundId, playerId: player.id, division, tagBefore: player.currentTag },
    });
  }

  return prisma.roundCheckIn.update({
    where: { id: existing.id },
    data: { division, tagBefore: existing.tagBefore ?? player.currentTag },
  });
}

export async function upsertResultsForRound(
  roundId: number,
  leagueId: number,
  parsed: ParsedImport
): Promise<{ blueCheckIns: number; redCheckIns: number; blueScores: number; redScores: number }> {
  const allResults = [
    ...parsed.blueResults.map((r) => ({ ...r, division: Division.BLUE })),
    ...parsed.redResults.map((r) => ({ ...r, division: Division.RED })),
  ];

  let blueCheckIns = 0;
  let redCheckIns = 0;
  let blueScores = 0;
  let redScores = 0;

  for (const result of allResults) {
    const player = await findOrCreatePlayer(leagueId, result);

    // Every player UDisc knows about is a participant — check them in (or
    // refresh their division) so they show up for sign-in/payment tracking
    // as soon as they join the event, even before they've posted a score.
    const checkIn = await upsertCheckIn(roundId, player, result.division);
    if (result.division === Division.BLUE) blueCheckIns++;
    else redCheckIns++;

    const hasScore = !result.isDnf && Object.keys(result.holeScores).length > 0;
    if (!hasScore) continue;

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
        // Prefer whatever was entered on the check-in tab before the round
        // started — it's more current than the player's general currentTag.
        tagBefore: checkIn.tagBefore ?? player.currentTag,
        tagAfter: checkIn.tagAfter,
        leftEarly: checkIn.leftEarly,
      },
      update: {
        division: result.division,
        position: result.position,
        score: result.roundTotalScore,
        relativeScore: result.roundRelativeScore,
        holeScores: result.holeScores,
      },
    });
    if (result.division === Division.BLUE) blueScores++;
    else redScores++;
  }

  return { blueCheckIns, redCheckIns, blueScores, redScores };
}

/** Check-ins from UDisc's /participants page, used before a round starts and
 *  the leaderboard export has no rows yet. No scores exist at this point. */
export async function upsertCheckInsFromParticipants(
  roundId: number,
  leagueId: number,
  participants: ParsedParticipant[]
): Promise<{ blueCheckIns: number; redCheckIns: number }> {
  let blueCheckIns = 0;
  let redCheckIns = 0;

  for (const participant of participants) {
    const player = await findOrCreatePlayer(leagueId, participant);

    await upsertCheckIn(roundId, player, participant.division);
    if (participant.division === Division.BLUE) blueCheckIns++;
    else redCheckIns++;
  }

  return { blueCheckIns, redCheckIns };
}
