import { prisma } from "@/lib/db";
import { getStandings } from "@/lib/standings";
import { computePoolSummaries, PoolSummary } from "@/lib/pool-utils";
import { notFound } from "next/navigation";
import { StandingsTable } from "@/components/standings-table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Division } from "@/generated/prisma/client";
import { formatDate, formatScore } from "@/lib/utils";
import Link from "next/link";

export const revalidate = 60;

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
        poolWinners: { orderBy: [{ pool: "asc" }, { place: "asc" }] },
        results: {
          include: { player: true },
          orderBy: [{ division: "asc" }, { position: "asc" }],
        },
      },
    }),
    prisma.round.count({ where: { leagueId, isChampionship: false } }),
  ]);

  const championshipRound = rounds.find((r) => r.isChampionship) ?? null;
  const summaryRound = championshipRound ?? (rounds[0] ?? null);

  const poolSummaries: PoolSummary[] = summaryRound?.isChampionship
    ? computePoolSummaries(summaryRound.results, standings, summaryRound.poolWinners)
    : [];

  return { league, standings, rounds, qualifyingRoundsPlayed, summaryRound, poolSummaries };
}

export default async function LeaguePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getData(Number(id));
  if (!data) notFound();

  const { league, standings, rounds, qualifyingRoundsPlayed, summaryRound, poolSummaries } = data;

  const blueCount = standings.filter((s) => s.division === Division.BLUE).length;
  const redCount = standings.filter((s) => s.division === Division.RED).length;
  const qualifiedCount = standings.filter((s) => s.qualified).length;
  const isComplete = rounds.some((r) => r.isChampionship);

  const blueSummaries = poolSummaries.filter((w) => ["A", "B"].includes(w.pool));
  const redSummaries = poolSummaries.filter((w) => ["C", "D"].includes(w.pool));

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

      {summaryRound?.isChampionship && poolSummaries.length > 0 && (
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
              <PoolSummaryColumn label="🔵 Blue Division" pools={blueSummaries} />
              <PoolSummaryColumn label="🔴 Red Division" pools={redSummaries} />
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

function PoolSummaryColumn({ label, pools }: { label: string; pools: PoolSummary[] }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-3">{label}</p>
      {pools.length === 0 ? (
        <p className="text-slate-400 text-sm">No results</p>
      ) : (
        <div className="space-y-3">
          {pools.map((w) => (
            <div key={w.pool} className="bg-white rounded-lg border border-amber-200 px-4 py-3 space-y-2">
              <p className="text-xs font-semibold text-amber-600 uppercase tracking-wide">Pool {w.pool}</p>
              {w.first && (
                <div className="flex items-center gap-2">
                  <span className="text-base">🥇</span>
                  <span className="font-semibold text-slate-900 text-sm">{w.first.playerName}</span>
                  <span className={`ml-auto font-mono text-xs ${
                    w.first.relativeScore < 0 ? "text-emerald-600" : w.first.relativeScore > 0 ? "text-red-500" : "text-slate-500"
                  }`}>
                    {w.first.score} ({formatScore(w.first.relativeScore)})
                  </span>
                </div>
              )}
              {w.second && (
                <div className="flex items-center gap-2">
                  <span className="text-base">🥈</span>
                  <span className="text-slate-700 text-sm">{w.second.playerName}</span>
                  <span className={`ml-auto font-mono text-xs ${
                    w.second.relativeScore < 0 ? "text-emerald-600" : w.second.relativeScore > 0 ? "text-red-500" : "text-slate-500"
                  }`}>
                    {w.second.score} ({formatScore(w.second.relativeScore)})
                  </span>
                </div>
              )}
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
