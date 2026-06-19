import { prisma } from "@/lib/db";
import { getStandings } from "@/lib/standings";
import { computeHoleStats } from "@/lib/course-stats";
import { CourseStatsSection } from "@/components/course-stats-tabs";
import { notFound } from "next/navigation";
import { Division, MemberStatus } from "@/generated/prisma/client";
import { formatDate, formatScore } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
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
      return { playerId: pid, qualifyingTotal: total, qualified, roundsPlayed: scores.length };
    });

    entries.sort((a, b) => {
      if (a.qualified !== b.qualified) return a.qualified ? -1 : 1;
      const aBucket = Math.min(a.roundsPlayed, bestScoresCount);
      const bBucket = Math.min(b.roundsPlayed, bestScoresCount);
      if (aBucket !== bBucket) return bBucket - aBucket;
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
  const [standings, allLeagueResults, ctpWins, aceWins, layoutRound, allRounds] = await Promise.all([
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
    prisma.round.findFirst({
      where: {
        leagueId: player.leagueId,
        ...(player.division === Division.BLUE
          ? { blueLayoutId: { not: null } }
          : { redLayoutId: { not: null } }),
      },
      orderBy: { weekNumber: "desc" },
      include: {
        blueLayout: { include: { holePars: { orderBy: { holeNumber: "asc" } } } },
        redLayout: { include: { holePars: { orderBy: { holeNumber: "asc" } } } },
      },
    }),
    prisma.round.findMany({
      where: { leagueId: player.leagueId },
      orderBy: { weekNumber: "desc" },
      select: { id: true, weekNumber: true, date: true, isChampionship: true },
    }),
  ]);

  const standing = standings.find((s) => s.playerId === player.id);
  const resultByRoundId = new Map(player.results.map((r) => [r.round.id, r]));

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
  const wins = qualifyingResults.filter((r) => r.position === 1).length;
  const top3 = qualifyingResults.filter((r) => r.position <= 3).length;
  const rankValues = [...rankByWeek.values()].map((v) => v.rank);
  const avgRank = rankValues.length > 0
    ? Math.round(rankValues.reduce((s, r) => s + r, 0) / rankValues.length)
    : null;

  // Per-hole stats
  const holePars = player.division === Division.BLUE
    ? (layoutRound?.blueLayout?.holePars ?? [])
    : (layoutRound?.redLayout?.holePars ?? []);
  const playerHoleStats = holePars.length > 0
    ? computeHoleStats(
        qualifyingResults.map((r) => r.holeScores as Record<string, number>),
        holePars
      )
    : null;

  // Round breakdown stats
  let roundBreakdown: {
    birdieOrBetterRate: number;
    parRate: number;
    bogeyOrWorseRate: number;
    eagles: number;
    aces: number;
    bestF9: number | null;
    f9Avg: number | null;
    bestB9: number | null;
    b9Avg: number | null;
  } | null = null;

  if (holePars.length > 0 && qualifyingResults.length > 0) {
    const parByHole = new Map(holePars.map((h) => [h.holeNumber, h.par]));
    const f9Pars = holePars.filter((h) => h.holeNumber <= 9);
    const b9Pars = holePars.filter((h) => h.holeNumber >= 10);
    const totalF9Par = f9Pars.reduce((s, h) => s + h.par, 0);
    const totalB9Par = b9Pars.reduce((s, h) => s + h.par, 0);

    let birdieOrBetter = 0, pars = 0, bogeyOrWorse = 0, eagles = 0, aces = 0, totalHoles = 0;
    const f9RelScores: number[] = [];
    const b9RelScores: number[] = [];

    for (const result of qualifyingResults) {
      const hs = result.holeScores as Record<string, number> | null;
      if (!hs) continue;

      let f9Score = 0, b9Score = 0;

      for (const [holeStr, score] of Object.entries(hs)) {
        const holeNum = parseInt(holeStr, 10);
        const par = parByHole.get(holeNum);
        if (par == null || isNaN(score)) continue;
        totalHoles++;
        const diff = score - par;
        if (diff <= -1) birdieOrBetter++;
        else if (diff === 0) pars++;
        else bogeyOrWorse++;
        if (diff <= -2) eagles++;
        if (score === 1) aces++;
        if (holeNum <= 9) f9Score += score;
        else b9Score += score;
      }

      if (totalF9Par > 0 && f9Pars.every((h) => hs[String(h.holeNumber)] != null))
        f9RelScores.push(f9Score - totalF9Par);
      if (totalB9Par > 0 && b9Pars.length > 0 && b9Pars.every((h) => hs[String(h.holeNumber)] != null))
        b9RelScores.push(b9Score - totalB9Par);
    }

    const pct = (n: number) => totalHoles > 0 ? Math.round((n / totalHoles) * 1000) / 10 : 0;
    const avg = (arr: number[]) => arr.length > 0
      ? Math.round((arr.reduce((s, x) => s + x, 0) / arr.length) * 10) / 10
      : null;

    roundBreakdown = {
      birdieOrBetterRate: pct(birdieOrBetter),
      parRate: pct(pars),
      bogeyOrWorseRate: pct(bogeyOrWorse),
      eagles,
      aces,
      bestF9: f9RelScores.length > 0 ? Math.min(...f9RelScores) : null,
      f9Avg: avg(f9RelScores),
      bestB9: b9RelScores.length > 0 ? Math.min(...b9RelScores) : null,
      b9Avg: avg(b9RelScores),
    };
  }

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
                  <a
                    href={`https://www.pdga.com/player/${player.pdgaNumber}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-white/70 text-sm hover:text-white transition-colors underline underline-offset-2"
                  >
                    PDGA #{player.pdgaNumber}
                  </a>
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
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-slate-900">
            {league.name} <span className="text-slate-400 font-normal">· {league.year}</span>
          </h2>
          <Card className="border-slate-200">
            <CardContent className="pt-5 divide-y divide-slate-100">
              {/* Headline stats */}
              <div className="pb-5 grid grid-cols-3 gap-3 text-center">
                <div>
                  <div className="text-2xl sm:text-3xl font-bold text-slate-900">#{standing.rank}</div>
                  <div className="text-xs text-slate-500 mt-0.5">Division Rank</div>
                </div>
                <div>
                  <div className={`text-2xl sm:text-3xl font-bold ${standing.qualified ? "text-emerald-600" : "text-orange-500"}`}>
                    {standing.qualified ? "Qualified" : "Not Qualified"}
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">Status</div>
                </div>
                <div>
                  <div className="text-2xl sm:text-3xl font-bold text-slate-900">
                    {standing.qualified ? standing.qualifyingTotal : "–"}
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">Best {league.bestScoresCount} Rounds</div>
                </div>
              </div>

              {/* Scoring + Achievements */}
              <div className="pt-4 flex flex-col sm:flex-row divide-y sm:divide-y-0 sm:divide-x divide-slate-100">
                <div className="flex-1 pb-4 sm:pb-0 sm:pr-6">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-3 text-center">Scoring</p>
                  <div className="flex justify-center gap-8">
                    <CompactStat label="Rounds Played" value={standing.roundsPlayed} center />
                    <CompactStat
                      label="Scoring Average"
                      value={avgScore != null ? formatScore(Math.round(avgScore * 10) / 10) : "–"}
                      valueClass={avgScore != null && avgScore < 0 ? "text-emerald-600" : avgScore != null && avgScore > 0 ? "text-orange-500" : undefined}
                      center
                    />
                    <CompactStat
                      label="Best Round"
                      value={bestRound != null ? formatScore(bestRound) : "–"}
                      valueClass={bestRound != null && bestRound < 0 ? "text-emerald-600" : bestRound != null && bestRound > 0 ? "text-orange-500" : undefined}
                      center
                    />
                  </div>
                </div>
                <div className="flex-1 pt-4 sm:pt-0 sm:pl-6">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-3 text-center">Achievements</p>
                  <div className="flex justify-center gap-8">
                    <CompactStat label="Wins" value={wins} valueClass={wins > 0 ? "text-amber-500" : undefined} center />
                    <CompactStat label="Top 3 Finishes" value={top3} valueClass={top3 > 0 ? "text-amber-500" : undefined} center />
                    {avgRank != null && <CompactStat label="Avg. Weekly Rank" value={`#${avgRank}`} center />}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Round breakdown */}
      {roundBreakdown && (
        <Card className="border-slate-200">
          <CardContent className="pt-5 divide-y divide-slate-100">
            {/* Shot distribution */}
            <div className="pb-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-3 text-center">Shot Distribution</p>
              <div className="flex items-center justify-around gap-1">
                <div className="flex flex-col items-center gap-1">
                  <RingChart pct={roundBreakdown.birdieOrBetterRate} color="#34d399" />
                  <span className="text-xs text-slate-500 text-center">Birdie or Better</span>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <RingChart pct={roundBreakdown.parRate} color="#94a3b8" />
                  <span className="text-xs text-slate-500 text-center">Par Rate</span>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <RingChart pct={roundBreakdown.bogeyOrWorseRate} color="#fb923c" />
                  <span className="text-xs text-slate-500 text-center">Bogey or Worse</span>
                </div>
              </div>
            </div>

            {/* Nine splits + Notable scores */}
            <div className="pt-4 flex flex-col sm:flex-row divide-y sm:divide-y-0 sm:divide-x divide-slate-100">
              {(roundBreakdown.bestF9 != null || roundBreakdown.bestB9 != null) && (
                <div className="flex-1 pb-4 sm:pb-0 sm:pr-6">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-3 text-center">Nine Splits</p>
                  <div className="flex justify-center gap-8">
                    {roundBreakdown.bestF9 != null && (
                      <CompactStat
                        label="Best F9"
                        value={formatScore(roundBreakdown.bestF9)}
                        valueClass={roundBreakdown.bestF9 < 0 ? "text-emerald-600" : roundBreakdown.bestF9 > 0 ? "text-orange-500" : undefined}
                      />
                    )}
                    {roundBreakdown.f9Avg != null && (
                      <CompactStat
                        label="F9 Avg"
                        value={formatScore(roundBreakdown.f9Avg)}
                        valueClass={roundBreakdown.f9Avg < 0 ? "text-emerald-600" : roundBreakdown.f9Avg > 0 ? "text-orange-500" : undefined}
                      />
                    )}
                    {roundBreakdown.bestB9 != null && (
                      <CompactStat
                        label="Best B9"
                        value={formatScore(roundBreakdown.bestB9)}
                        valueClass={roundBreakdown.bestB9 < 0 ? "text-emerald-600" : roundBreakdown.bestB9 > 0 ? "text-orange-500" : undefined}
                      />
                    )}
                    {roundBreakdown.b9Avg != null && (
                      <CompactStat
                        label="B9 Avg"
                        value={formatScore(roundBreakdown.b9Avg)}
                        valueClass={roundBreakdown.b9Avg < 0 ? "text-emerald-600" : roundBreakdown.b9Avg > 0 ? "text-orange-500" : undefined}
                      />
                    )}
                  </div>
                </div>
              )}
              <div className="flex-1 pt-4 sm:pt-0 sm:pl-6">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-3 text-center">Notable Scores</p>
                <div className="flex justify-center gap-10">
                  <CompactStat
                    label="Eagles"
                    value={roundBreakdown.eagles}
                    valueClass={roundBreakdown.eagles > 0 ? "text-emerald-600" : undefined}
                  />
                  <CompactStat
                    label="Aces"
                    value={roundBreakdown.aces}
                    valueClass={roundBreakdown.aces > 0 ? "text-purple-600" : undefined}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Per-hole performance */}
      {playerHoleStats && qualifyingResults.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-slate-900 mb-3">Hole Performance</h2>
          <CourseStatsSection stats={playerHoleStats} />
        </div>
      )}

      {/* Round history */}
      {allRounds.length > 0 && (
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
                {allRounds.map((round, idx) => {
                  const result = resultByRoundId.get(round.id);
                  const weekStanding = round.isChampionship
                    ? null
                    : rankByWeek.get(round.weekNumber) ?? null;

                  return (
                    <tr
                      key={round.id}
                      className={`border-t border-slate-100 hover:bg-slate-50 transition-colors ${idx % 2 === 1 ? "bg-slate-50/50" : ""}`}
                    >
                      <td className="px-4 py-3">
                        <Link
                          href={`/rounds/${round.id}?league=${player.leagueId}`}
                          className="font-medium text-blue-600 hover:underline"
                        >
                          {round.isChampionship ? "🏆 Championship" : `Week ${round.weekNumber}`}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-slate-500 hidden sm:table-cell">
                        {formatDate(round.date)}
                      </td>
                      <td className="px-4 py-3 text-center font-mono tabular-nums text-slate-800">
                        {result ? result.score : <span className="text-slate-300 text-xs">DNS</span>}
                      </td>
                      <td className={`px-4 py-3 text-center font-mono font-semibold tabular-nums ${
                        result
                          ? result.relativeScore < 0
                            ? "text-emerald-600"
                            : result.relativeScore > 0
                            ? "text-orange-500"
                            : "text-slate-500"
                          : ""
                      }`}>
                        {result ? formatScore(result.relativeScore) : <span className="text-slate-300 text-xs">—</span>}
                      </td>
                      <td className="px-4 py-3 text-center text-slate-600 hidden sm:table-cell">
                        {result ? formatPosition(result.position) : <span className="text-slate-300 text-xs">—</span>}
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

function RingChart({ pct, color, track = "#f1f5f9" }: { pct: number; color: string; track?: string }) {
  const r = 36;
  const circ = 2 * Math.PI * r;
  const filled = (pct / 100) * circ;
  return (
    <svg viewBox="0 0 100 100" className="w-24 h-24 sm:w-32 sm:h-32">
      <circle cx="50" cy="50" r={r} fill="none" stroke={track} strokeWidth="11" />
      <circle cx="50" cy="50" r={r} fill="none" stroke={color} strokeWidth="11"
        strokeLinecap="round"
        strokeDasharray={`${filled} ${circ - filled}`}
        transform="rotate(-90 50 50)" />
      <text x="50" y="55" textAnchor="middle" fill="#0f172a" fontSize="15" fontWeight="700">{pct}%</text>
    </svg>
  );
}

function CompactStat({
  label,
  value,
  valueClass,
  center,
}: {
  label: string;
  value: string | number;
  valueClass?: string;
  center?: boolean;
}) {
  return (
    <div className={center ? "text-center" : undefined}>
      <div className={`text-xl font-bold tabular-nums ${valueClass ?? "text-slate-900"}`}>{value}</div>
      <div className="text-xs text-slate-500 mt-0.5">{label}</div>
    </div>
  );
}
