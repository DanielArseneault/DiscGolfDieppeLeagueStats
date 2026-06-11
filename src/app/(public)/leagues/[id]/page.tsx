import { prisma } from "@/lib/db";
import { getStandings } from "@/lib/standings";
import { notFound } from "next/navigation";
import { StandingsTable } from "@/components/standings-table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Division } from "@/generated/prisma/client";
import { formatDate, formatScore } from "@/lib/utils";
import Link from "next/link";

export const revalidate = 60;

type PoolWinner = { pool: string; playerName: string; score: number; relativeScore: number };

async function getData(leagueId: number) {
  const [league, standings] = await Promise.all([
    prisma.league.findUnique({ where: { id: leagueId } }),
    getStandings(leagueId),
  ]);

  if (!league) return null;

  const [rounds, qualifyingRoundsPlayed] = await Promise.all([
    prisma.round.findMany({
      where: { leagueId },
      orderBy: { weekNumber: "desc" },
      include: {
        _count: { select: { results: true } },
        ctpWinners: true,
        poolWinners: { orderBy: { pool: "asc" } },
        results: {
          include: { player: true },
          orderBy: [{ division: "asc" }, { position: "asc" }],
        },
      },
    }),
    prisma.round.count({ where: { leagueId, isChampionship: false } }),
  ]);

  // Championship round = the most recent round marked isChampionship
  const championshipRound = rounds.find((r) => r.isChampionship) ?? null;
  // Most recent non-championship round (for the summary card if no championship)
  const recentRound = rounds[0] ?? null;

  // Compute pool winners (with saved overrides)
  const poolWinners: PoolWinner[] = [];
  const summaryRound = championshipRound ?? recentRound;

  if (summaryRound?.isChampionship) {
    const savedOverrides = new Map<string, string>();
    for (const pw of summaryRound.poolWinners) savedOverrides.set(pw.pool, pw.playerName);

    const playerPoolMap = new Map<number, string>();
    for (const s of standings) {
      if (s.championshipPool) playerPoolMap.set(s.playerId, s.championshipPool);
    }

    const seen = new Set<string>();
    for (const result of summaryRound.results) {
      const pool = playerPoolMap.get(result.playerId);
      if (!pool || seen.has(pool)) continue;
      seen.add(pool);
      const overrideName = savedOverrides.get(pool);
      if (overrideName) {
        const or = summaryRound.results.find((r) => r.player.name === overrideName);
        if (or) { poolWinners.push({ pool, playerName: overrideName, score: or.score, relativeScore: or.relativeScore }); continue; }
      }
      poolWinners.push({ pool, playerName: result.player.name, score: result.score, relativeScore: result.relativeScore });
    }
    poolWinners.sort((a, b) => a.pool.localeCompare(b.pool));
  }

  return { league, standings, rounds, qualifyingRoundsPlayed, summaryRound, poolWinners };
}

export default async function LeaguePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getData(Number(id));
  if (!data) notFound();

  const { league, standings, rounds, qualifyingRoundsPlayed, summaryRound, poolWinners } = data;

  const blueCount = standings.filter((s) => s.division === Division.BLUE).length;
  const redCount = standings.filter((s) => s.division === Division.RED).length;
  const qualifiedCount = standings.filter((s) => s.qualified).length;
  const isComplete = rounds.some((r) => r.isChampionship);

  const bluePools = poolWinners.filter((w) => ["A", "B"].includes(w.pool));
  const redPools = poolWinners.filter((w) => ["C", "D"].includes(w.pool));

  return (
    <div className="space-y-8">
      <div>
        <Link href="/leagues" className="text-sm text-slate-500 hover:text-slate-700 mb-2 inline-block">
          ← All Seasons
        </Link>
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold text-slate-900">{league.name}</h1>
          {isComplete && (
            <span className="text-sm bg-amber-100 text-amber-700 font-medium px-2.5 py-0.5 rounded-full">
              🏆 Complete
            </span>
          )}
        </div>
        <p className="text-slate-500 mt-1">
          {formatDate(league.startDate)} – {formatDate(league.endDate)} · {league.location}
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Blue Division" value={blueCount} />
        <StatCard label="Red Division" value={redCount} />
        <StatCard label="Qualified" value={qualifiedCount} />
        <StatCard label="Rounds Played" value={qualifyingRoundsPlayed} />
      </div>

      {/* Championship summary */}
      {summaryRound?.isChampionship && poolWinners.length > 0 && (
        <Card className="border-amber-300 bg-gradient-to-br from-amber-50 to-white">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-2xl">🏆</span>
                <div>
                  <CardTitle className="text-xl">Championship Results</CardTitle>
                  <p className="text-sm text-slate-500 mt-0.5">{formatDate(summaryRound.date)} · {summaryRound._count.results} players</p>
                </div>
              </div>
              <Link href={`/rounds/${summaryRound.id}`} className="text-sm text-blue-600 hover:underline">
                Full scorecard →
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-6">
              <PoolColumn label="🔵 Blue Division" pools={bluePools} />
              <PoolColumn label="🔴 Red Division" pools={redPools} />
            </div>
            {summaryRound.ctpWinners.length > 0 && (
              <div className="mt-4 pt-4 border-t border-amber-100">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">🎯 CTP Winners</p>
                <div className="flex flex-wrap gap-2">
                  {summaryRound.ctpWinners.map((c) => (
                    <Badge key={c.id} variant="secondary">Hole {c.hole}: {c.playerName}</Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Recent regular round (no championship) */}
      {summaryRound && !summaryRound.isChampionship && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Week {summaryRound.weekNumber} — Recent Results</CardTitle>
              <Link href={`/rounds/${summaryRound.id}`} className="text-sm text-blue-600 hover:underline">
                Full scorecard →
              </Link>
            </div>
            <p className="text-sm text-slate-500">
              {formatDate(summaryRound.date)} · {summaryRound._count.results} players
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-6">
              {([Division.BLUE, Division.RED] as Division[]).map((div) => {
                const top3 = summaryRound.results.filter((r) => r.division === div).slice(0, 3);
                return (
                  <div key={div}>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">
                      {div === Division.BLUE ? "🔵 Blue Division" : "🔴 Red Division"}
                    </p>
                    <ol className="space-y-1">
                      {top3.map((r, i) => (
                        <li key={r.id} className="flex items-center gap-3 text-sm">
                          <span className="text-slate-400 w-4 text-right">{i + 1}.</span>
                          <span className="font-medium text-slate-900">{r.player.name}</span>
                          <span className={`ml-auto font-mono text-xs ${
                            r.relativeScore < 0 ? "text-emerald-600" : r.relativeScore > 0 ? "text-red-500" : "text-slate-500"
                          }`}>
                            {r.score} ({formatScore(r.relativeScore)})
                          </span>
                        </li>
                      ))}
                    </ol>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Standings */}
      <div>
        <h2 className="text-xl font-semibold text-slate-900 mb-4">
          {isComplete ? "Final Standings" : "Season Standings"}
        </h2>
        <Card>
          <CardContent className="pt-6">
            <Tabs defaultValue="blue">
              <TabsList className="mb-4">
                <TabsTrigger value="blue">🔵 Blue Division</TabsTrigger>
                <TabsTrigger value="red">🔴 Red Division</TabsTrigger>
              </TabsList>
              <TabsContent value="blue">
                <StandingsTable standings={standings} division={Division.BLUE} bestScoresCount={league.bestScoresCount} />
              </TabsContent>
              <TabsContent value="red">
                <StandingsTable standings={standings} division={Division.RED} bestScoresCount={league.bestScoresCount} />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      {/* Rounds list */}
      <div>
        <h2 className="text-xl font-semibold text-slate-900 mb-4">Rounds</h2>
        {rounds.length === 0 ? (
          <p className="text-slate-500">No rounds recorded yet.</p>
        ) : (
          <div className="space-y-2">
            {rounds.map((round) => (
              <Link key={round.id} href={`/rounds/${round.id}`}>
                <Card className={`hover:shadow-md transition-shadow cursor-pointer ${round.isChampionship ? "border-amber-200 bg-amber-50/30" : ""}`}>
                  <CardContent className="py-3 flex items-center justify-between">
                    <div>
                      <div className="font-medium text-slate-900">
                        {round.isChampionship ? "🏆 Championship" : `Week ${round.weekNumber}`}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">{formatDate(round.date)}</div>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-500">
                      <span>{round._count.results} players</span>
                      {round.ctpWinners.length > 0 && (
                        <Badge variant="secondary" className="text-xs">🎯 {round.ctpWinners.length} CTP</Badge>
                      )}
                      <span className="text-slate-300">→</span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function PoolColumn({ label, pools }: { label: string; pools: PoolWinner[] }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-3">{label}</p>
      {pools.length === 0 ? (
        <p className="text-slate-400 text-sm">No results</p>
      ) : (
        <div className="space-y-3">
          {pools.map((w) => (
            <div key={w.pool} className="flex items-center justify-between bg-white rounded-lg border border-amber-200 px-4 py-3">
              <div>
                <p className="text-xs font-semibold text-amber-600 uppercase tracking-wide mb-0.5">Pool {w.pool} Champion</p>
                <p className="font-semibold text-slate-900 text-base">{w.playerName}</p>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold tabular-nums text-slate-900">{w.score}</p>
                <p className={`text-xs font-mono ${
                  w.relativeScore < 0 ? "text-emerald-600" : w.relativeScore > 0 ? "text-red-500" : "text-slate-500"
                }`}>
                  {formatScore(w.relativeScore)}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent className="pt-4 pb-4">
        <div className="text-2xl font-bold text-slate-900 tabular-nums">{value}</div>
        <div className="text-xs text-slate-500 mt-0.5">{label}</div>
      </CardContent>
    </Card>
  );
}
