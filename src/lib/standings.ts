import { cache } from "react";
import { prisma } from "@/lib/db";
import { Division } from "@/generated/prisma/client";

export interface PlayerStanding {
  playerId: number;
  playerName: string;
  division: Division;
  roundsPlayed: number;
  allScores: number[];
  bestScores: number[];
  qualifyingTotal: number;
  qualified: boolean;
  excludeFromChampionship: boolean;
  championshipPoolOverride: string | null;
  rank: number;
  championshipPool: string | null;
}

export const getStandings = cache(async function getStandings(leagueId: number): Promise<PlayerStanding[]> {
  const league = await prisma.league.findUnique({ where: { id: leagueId } });
  if (!league) return [];

  const qualifyingRounds = await prisma.round.findMany({
    where: {
      leagueId,
      isChampionship: false,
      weekNumber: { lte: league.qualifyingWeeks },
    },
    select: { id: true },
  });
  const qualifyingRoundIds = qualifyingRounds.map((r) => r.id);

  const results = await prisma.result.findMany({
    where: { roundId: { in: qualifyingRoundIds } },
    include: { player: true },
  });

  const playerMap = new Map<number, { name: string; division: Division; scores: number[]; excludeFromChampionship: boolean; championshipPoolOverride: string | null }>();

  for (const result of results) {
    if (!playerMap.has(result.playerId)) {
      playerMap.set(result.playerId, {
        name: result.player.name,
        division: result.player.division,
        excludeFromChampionship: result.player.excludeFromChampionship,
        championshipPoolOverride: result.player.championshipPoolOverride,
        scores: [],
      });
    }
    playerMap.get(result.playerId)!.scores.push(result.score);
  }

  const standings: PlayerStanding[] = [];

  for (const [playerId, data] of playerMap.entries()) {
    const sorted = [...data.scores].sort((a, b) => a - b);
    const bestScores = sorted.slice(0, league.bestScoresCount);
    const qualifyingTotal = bestScores.reduce((sum, s) => sum + s, 0);
    const qualified = data.scores.length >= league.minWeeks;

    standings.push({
      playerId,
      playerName: data.name,
      division: data.division,
      roundsPlayed: data.scores.length,
      allScores: data.scores,
      bestScores,
      qualifyingTotal,
      qualified,
      excludeFromChampionship: data.excludeFromChampionship,
      championshipPoolOverride: data.championshipPoolOverride,
      rank: 0,
      championshipPool: null,
    });
  }

  rankAndAssignPools(standings, Division.BLUE, "A", "B");
  rankAndAssignPools(standings, Division.RED, "C", "D");

  return standings.sort((a, b) => {
    if (a.division !== b.division) return a.division === Division.BLUE ? -1 : 1;
    return a.rank - b.rank;
  });
});

function rankAndAssignPools(
  standings: PlayerStanding[],
  division: Division,
  topPool: string,
  bottomPool: string
) {
  const divisionStandings = standings
    .filter((s) => s.division === division)
    .sort((a, b) => {
      if (a.qualified !== b.qualified) return a.qualified ? -1 : 1;
      if (a.qualifyingTotal !== b.qualifyingTotal) return a.qualifyingTotal - b.qualifyingTotal;
      return a.playerName.localeCompare(b.playerName);
    });

  const qualified = divisionStandings.filter((s) => s.qualified && !s.excludeFromChampionship);
  const cutoff = Math.ceil(qualified.length / 2);
  const cutoffScore = qualified[cutoff - 1]?.qualifyingTotal;

  divisionStandings.forEach((s, i) => {
    s.rank = i + 1;
    if (!s.qualified || s.excludeFromChampionship) return;

    // Auto-assign based on score; override replaces the result afterward
    const autoPool = s.qualifyingTotal <= cutoffScore ? topPool : bottomPool;
    s.championshipPool = s.championshipPoolOverride ?? autoPool;
  });
}
