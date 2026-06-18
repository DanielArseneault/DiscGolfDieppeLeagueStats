import { prisma } from "@/lib/db";
import { getStandings } from "@/lib/standings";
import { notFound } from "next/navigation";
import { Division, MemberStatus } from "@/generated/prisma/client";
import { formatDate, formatScore } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

export const revalidate = 60;

// Compute the player's division rank after each qualifying week, in chronological order.
// Returns a map of weekNumber → { rank, change } where change is positions gained (positive = up).
function computeProgressiveStandings(
  allResults: Array<{
    playerId: number;
    score: number;
    round: { weekNumber: number };
    player: { division: Division };
  }>,
  targetPlayerId: number,
  targetDivision: Division,
  bestScoresCount: number,
  minWeeks: number
): Map<number, { rank: number; change: number | null }> {
  const weeks = [...new Set(allResults.map((r) => r.round.weekNumber))].sort((a, b) => a - b);
  const rankByWeek = new Map<number, { rank: number; change: number | null }>();
  let prevRank: number | null = null;

  for (const week of weeks) {
    // Only track weeks where this player actually played
    const playedThisWeek = allResults.some(
      (r) => r.playerId === targetPlayerId && r.round.weekNumber === week
    );
    if (!playedThisWeek) continue;

    const subset = allResults.filter((r) => r.round.weekNumber <= week);

    // Group scores by player (same division only needed for ranking)
    const playerScores = new Map<number, number[]>();
    for (const r of subset) {
      if (r.player.division !== targetDivision) continue;
      if (!playerScores.has(r.playerId)) playerScores.set(r.playerId, []);
      playerScores.get(r.playerId)!.push(r.score);
    }

    // Compute qualifying totals and rank
    const entries = [...playerScores.entries()].map(([pid, scores]) => {
      const best = [...scores].sort((a, b) => a - b).slice(0, bestScoresCount);
      const total = best.reduce((s, x) => s + x, 0);
      const qualified = scores.length >= minWeeks;
      return { playerId: pid, qualifyingTotal: total, qualified };
    });

    entries.sort((a, b) => {
      if (a.qualified !== b.qualified) return a.qualified ? -1 : 1;
      return a.qualifyingTotal - b.qualifyingTotal;
    });

    const rank = entries.findIndex((e) => e.playerId === targetPlayerId) + 1;
    if (rank === 0) continue;

    const change = prevRank != null ? prevRank - rank : null;
    rankByWeek.set(week, { rank, change });
    prevRank = rank;
  }

  return rankByWeek;
}

export default async function PlayerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const player = await prisma.player.findUnique({
    where: { id: Number(id) },
    include: {
      league: true,
      results: {
        include: {
          round: {
            select: { id: true, weekNumber: true, date: true, isChampionship: true },
          },
        },
        orderBy: { round: { weekNumber: "desc" } },
      },
    },
  });

  if (!player) notFound();

  const { league } = player;

  // All qualifying results for the league (all players) — for progressive standings
  const [standings, allLeagueResults, ctpWins, aceWins] = await Promise.all([
    getStandings(player.leagueId),
    prisma.result.findMany({
      where: {
        round: {
          leagueId: player.leagueId,
          isChampionship: false,
          weekNumber: { lte: league.qualifyingWeeks },
        },
      },
      select: {
        playerId: true,
        score: true,
        round: { select: { weekNumber: true } },
        player: { select: { division: true } },
      },
    }),
    prisma.ctpWinner.findMany({
      where: { playerName: player.name, round: { leagueId: player.leagueId } },
      include: { round: { select: { id: true, weekNumber: true } } },
      orderBy: { round: { weekNumber: "asc" } },
    }),
    prisma.aceWinner.findMany({
      where: { playerName: player.name, round: { leagueId: player.leagueId } },
      include: { round: { select: { id: true, weekNumber: true } } },
      orderBy: { round: { weekNumber: "asc" } },
    }),
  ]);

  const standing = standings.find((s) => s.playerId === player.id);

  const rankByWeek = computeProgressiveStandings(
    allLeagueResults,
    player.id,
    player.division,
    league.bestScoresCount,
    league.minWeeks
  );

  // Scoring stats (qualifying rounds only)
  const qualifyingResults = player.results.filter((r) => !r.round.isChampionship);
  const avgScore = qualifyingResults.length > 0
    ? qualifyingResults.reduce((s, r) => s + r.relativeScore, 0) / qualifyingResults.length
    : null;
  const bestRound = qualifyingResults.length > 0
    ? Math.min(...qualifyingResults.map((r) => r.relativeScore))
    : null;

  const leagueUrl = `/?league=${player.leagueId}`;

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="-mx-4 -mt-14 relative overflow-hidden mb-2">
        <div className="px-8 pt-24 pb-32 text-white relative bg-gradient-to-br from-green-900 via-green-800 to-slate-800">
          <div className="absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-black/30 to-transparent pointer-events-none" />
          <div className="relative">
            <div className="flex items-center gap-2 text-white/60 text-xs font-semibold uppercase tracking-widest mb-2">
              <Link href={leagueUrl} className="hover:text-white/90 transition-colors">Standings</Link>
              <span>/</span>
              <span>{player.name}</span>
            </div>
            <h1 className="text-4xl font-black tracking-tight drop-shadow-sm">{player.name}</h1>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2">
              <span className="text-white/70 text-sm">{league.name}</span>
              <span className="text-white/30">·</span>
              <span className={`text-sm font-semibold ${player.division === Division.BLUE ? "text-blue-300" : "text-red-300"}`}>
                {player.division === Division.BLUE ? "🔵 Blue Division" : "🔴 Red Division"}
              </span>
              {player.memberStatus === MemberStatus.MEMBER && (
                <>
                  <span className="text-white/30">·</span>
                  <span className="text-xs bg-white/20 text-white px-2 py-0.5 rounded-full font-medium">Member</span>
                </>
              )}
              {player.pdgaNumber && (
                <>
                  <span className="text-white/30">·</span>
                  <span className="text-white/70 text-sm">PDGA #{player.pdgaNumber}</span>
                </>
              )}
            </div>
          </div>
        </div>
        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1200 56" preserveAspectRatio="none" className="w-full h-14 fill-[#f8fafc]">
            <path d="M0,56 L0,28 C150,56 300,8 500,22 C700,36 900,4 1200,22 L1200,56 Z" />
          </svg>
        </div>
      </div>

      {/* Season stats */}
      {standing && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <StatCard label="Division Rank" value={`#${standing.rank}`} />
          <StatCard label="Rounds Played" value={standing.roundsPlayed} />
          <StatCard
            label={`Best ${league.bestScoresCount} Total`}
            value={standing.qualified ? standing.qualifyingTotal : "–"}
          />
          <StatCard
            label="Scoring Average"
            value={avgScore != null ? formatScore(Math.round(avgScore * 10) / 10) : "–"}
            valueClass={avgScore != null && avgScore < 0 ? "text-emerald-600" : avgScore != null && avgScore > 0 ? "text-orange-500" : "text-slate-900"}
          />
          <StatCard
            label="Best Round"
            value={bestRound != null ? formatScore(bestRound) : "–"}
            valueClass={bestRound != null && bestRound < 0 ? "text-emerald-600" : bestRound != null && bestRound > 0 ? "text-orange-500" : "text-slate-900"}
          />
          <StatCard
            label="Status"
            value={standing.qualified ? "Qualified" : "Not Qualified"}
            valueClass={standing.qualified ? "text-emerald-600" : "text-orange-500"}
          />
        </div>
      )}

      {/* Round history */}
      {player.results.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-slate-900 mb-3">Round History</h2>
          <div className="rounded-xl overflow-hidden border border-slate-200">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-700 text-left">
                  <th className="px-4 py-3 font-medium text-slate-200">Round</th>
                  <th className="px-4 py-3 font-medium text-slate-200 hidden sm:table-cell">Date</th>
                  <th className="px-4 py-3 font-medium text-slate-200 text-center">Score</th>
                  <th className="px-4 py-3 font-medium text-slate-200 text-center">+/−</th>
                  <th className="px-4 py-3 font-medium text-slate-200 text-center hidden sm:table-cell">Round Pos.</th>
                  <th className="px-4 py-3 font-medium text-slate-200 text-center">Standing</th>
                </tr>
              </thead>
              <tbody>
                {player.results.map((result, idx) => {
                  const weekStanding = result.round.isChampionship
                    ? null
                    : rankByWeek.get(result.round.weekNumber) ?? null;

                  return (
                    <tr
                      key={result.id}
                      className={`border-t border-slate-100 hover:bg-slate-50 transition-colors ${idx % 2 === 1 ? "bg-slate-50/50" : ""}`}
                    >
                      <td className="px-4 py-3">
                        <Link
                          href={`/rounds/${result.round.id}?league=${player.leagueId}`}
                          className="font-medium text-blue-600 hover:underline"
                        >
                          {result.round.isChampionship ? "🏆 Championship" : `Week ${result.round.weekNumber}`}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-slate-500 hidden sm:table-cell">
                        {formatDate(result.round.date)}
                      </td>
                      <td className="px-4 py-3 text-center font-mono tabular-nums text-slate-800">
                        {result.score}
                      </td>
                      <td className={`px-4 py-3 text-center font-mono font-semibold tabular-nums ${
                        result.relativeScore < 0
                          ? "text-emerald-600"
                          : result.relativeScore > 0
                          ? "text-orange-500"
                          : "text-slate-500"
                      }`}>
                        {formatScore(result.relativeScore)}
                      </td>
                      <td className="px-4 py-3 text-center text-slate-600 hidden sm:table-cell">
                        {formatPosition(result.position)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {weekStanding ? (
                          <span className="inline-flex items-center gap-1.5">
                            <span className="font-semibold text-slate-800">#{weekStanding.rank}</span>
                            <RankChange change={weekStanding.change} />
                          </span>
                        ) : (
                          <span className="text-slate-300 text-xs">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CTP wins */}
      {ctpWins.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-slate-900 mb-3">🎯 Closest to Pin</h2>
          <div className="flex flex-wrap gap-2">
            {ctpWins.map((c) => (
              <Link key={c.id} href={`/rounds/${c.round.id}?league=${player.leagueId}`}>
                <Badge className="bg-orange-100 text-orange-800 border border-orange-200 hover:bg-orange-200 cursor-pointer text-sm">
                  Week {c.round.weekNumber} · Hole {c.hole}
                </Badge>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Ace wins */}
      {aceWins.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-slate-900 mb-3">🦅 Aces</h2>
          <div className="flex flex-wrap gap-2">
            {aceWins.map((a) => (
              <Link key={a.id} href={`/rounds/${a.round.id}?league=${player.leagueId}`}>
                <Badge className="bg-purple-100 text-purple-800 border border-purple-200 hover:bg-purple-200 cursor-pointer text-sm">
                  Week {a.round.weekNumber} · Hole {a.hole}
                  {a.prizeAmount != null ? ` · $${a.prizeAmount.toFixed(2)}` : ""}
                </Badge>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function RankChange({ change }: { change: number | null }) {
  if (change === null) return <span className="text-xs text-slate-400">new</span>;
  if (change === 0) return <span className="text-xs text-slate-400">—</span>;
  if (change > 0) return <span className="text-xs font-semibold text-emerald-500">↑{change}</span>;
  return <span className="text-xs font-semibold text-red-400">↓{Math.abs(change)}</span>;
}

function formatPosition(pos: number): string {
  if (pos === 1) return "🥇 1st";
  if (pos === 2) return "🥈 2nd";
  if (pos === 3) return "🥉 3rd";
  const suffix =
    pos % 10 === 1 && pos !== 11 ? "st"
    : pos % 10 === 2 && pos !== 12 ? "nd"
    : pos % 10 === 3 && pos !== 13 ? "rd"
    : "th";
  return `${pos}${suffix}`;
}

function StatCard({
  label,
  value,
  valueClass,
}: {
  label: string;
  value: string | number;
  valueClass?: string;
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl px-5 py-4">
      <div className={`text-2xl font-bold tabular-nums ${valueClass ?? "text-slate-900"}`}>
        {value}
      </div>
      <div className="text-xs text-slate-500 mt-0.5">{label}</div>
    </div>
  );
}
