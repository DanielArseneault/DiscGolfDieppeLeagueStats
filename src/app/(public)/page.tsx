import { prisma } from "@/lib/db";
import { getStandings } from "@/lib/standings";
import { computePoolSummaries, PoolSummary } from "@/lib/pool-utils";
import { StandingsTable } from "@/components/standings-table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Division } from "@/generated/prisma/client";
import { formatDate, formatScore } from "@/lib/utils";
import Link from "next/link";

export const revalidate = 60;

async function getData() {
  const league = await prisma.league.findFirst({ orderBy: { year: "desc" } });
  if (!league) return { league: null, standings: [], recentRound: null, qualifyingRoundsPlayed: 0, poolSummaries: [] as PoolSummary[], totalLeagues: 0 };

  const [standings, recentRound, qualifyingRoundsPlayed, totalLeagues] = await Promise.all([
    getStandings(league.id),
    prisma.round.findFirst({
      where: { leagueId: league.id },
      orderBy: { weekNumber: "desc" },
      include: {
        results: {
          include: { player: true },
          orderBy: [{ division: "asc" }, { position: "asc" }],
        },
        ctpWinners: { orderBy: { hole: "asc" } },
        poolWinners: { orderBy: [{ pool: "asc" }, { place: "asc" }] },
        _count: { select: { results: true } },
      },
    }),
    prisma.round.count({ where: { leagueId: league.id, isChampionship: false } }),
    prisma.league.count(),
  ]);

  const poolSummaries: PoolSummary[] = recentRound?.isChampionship
    ? computePoolSummaries(recentRound.results, standings, recentRound.poolWinners)
    : [];

  return { league, standings, recentRound, qualifyingRoundsPlayed, poolSummaries, totalLeagues };
}

export default async function HomePage() {
  const { league, standings, recentRound, qualifyingRoundsPlayed, poolSummaries, totalLeagues } = await getData();

  if (!league) {
    return (
      <div className="text-center py-24">
        <div className="text-5xl mb-4">🥏</div>
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Welcome to Dieppe DGC League</h1>
        <p className="text-slate-500">No league data yet. Visit the admin panel to get started.</p>
        <Link href="/admin" className="mt-4 inline-block text-sm text-green-700 hover:text-green-900 hover:underline">
          Go to Admin →
        </Link>
      </div>
    );
  }

  const blueCount = standings.filter((s) => s.division === Division.BLUE).length;
  const redCount = standings.filter((s) => s.division === Division.RED).length;
  const qualifiedCount = standings.filter((s) => s.qualified).length;

  return (
    <div className="space-y-8">
      {/* Hero banner */}
      <div className="-mx-4 -mt-14 relative overflow-hidden mb-2">
        <div className="bg-gradient-to-br from-sky-400 via-teal-500 to-green-700 px-8 pt-24 pb-24 text-white relative">
          {/* Dark scrim at top so nav text stays legible over the lighter gradient */}
          <div className="absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-black/30 to-transparent pointer-events-none" />
          <div className="relative flex items-start justify-between gap-4">
            <div>
              <h1 className="text-4xl font-black tracking-tight drop-shadow-sm">{league.name}</h1>
              <p className="text-teal-100 mt-2 text-sm">
                {formatDate(league.startDate)} – {formatDate(league.endDate)} · {league.location}
              </p>
            </div>
            {totalLeagues > 1 && (
              <Link href="/leagues" className="text-sm text-teal-200 hover:text-white mt-1 shrink-0 transition-colors">
                Previous seasons →
              </Link>
            )}
          </div>
        </div>
        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1200 56" preserveAspectRatio="none" className="w-full h-14 fill-slate-50">
            <path d="M0,56 L0,28 C150,56 300,8 500,22 C700,36 900,4 1200,22 L1200,56 Z" />
          </svg>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Blue Division" value={blueCount} />
        <StatCard label="Red Division" value={redCount} />
        <StatCard label="Qualified" value={qualifiedCount} />
        <StatCard label="Rounds Played" value={qualifyingRoundsPlayed} />
      </div>

      {recentRound && (
        recentRound.isChampionship
          ? <ChampionshipResults round={recentRound} poolSummaries={poolSummaries} />
          : <RecentRound round={recentRound} />
      )}

      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-slate-900">
            {recentRound?.isChampionship ? "Final Standings" : "Season Standings"}
          </h2>
          <Link href="/rounds" className="text-sm text-green-700 hover:text-green-900 hover:underline transition-colors">
            All rounds →
          </Link>
        </div>
        <Card className="border-slate-200">
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
    </div>
  );
}

// ── Normal round ──────────────────────────────────────────────────────────────

type RoundData = NonNullable<Awaited<ReturnType<typeof getData>>["recentRound"]>;

function RecentRound({ round }: { round: RoundData }) {
  return (
    <Card className="border-slate-200">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-slate-900">Week {round.weekNumber} — Recent Results</CardTitle>
          <Link href={`/rounds/${round.id}`} className="text-sm text-green-700 hover:text-green-900 hover:underline transition-colors">
            Full scorecard →
          </Link>
        </div>
        <p className="text-sm text-slate-500">
          {formatDate(round.date)} · {round._count.results} players
        </p>
      </CardHeader>
      <CardContent>
        <div className="grid md:grid-cols-2 gap-6">
          {([Division.BLUE, Division.RED] as Division[]).map((div) => {
            const top3 = round.results.filter((r) => r.division === div).slice(0, 3);
            return (
              <div key={div}>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">
                  {div === Division.BLUE ? "🔵 Blue Division" : "🔴 Red Division"}
                </p>
                {top3.length === 0 ? (
                  <p className="text-slate-400 text-sm">No results</p>
                ) : (
                  <ol className="space-y-1">
                    {top3.map((r, i) => (
                      <li key={r.id} className="flex items-center gap-3 text-sm">
                        <span className="text-slate-400 w-4 text-right">{i + 1}.</span>
                        <span className="font-medium text-slate-900">{r.player.name}</span>
                        <span className={`ml-auto font-mono text-xs ${
                          r.relativeScore < 0 ? "text-emerald-600" : r.relativeScore > 0 ? "text-orange-500" : "text-slate-500"
                        }`}>
                          {r.score} ({formatScore(r.relativeScore)})
                        </span>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            );
          })}
        </div>
        {round.ctpWinners.length > 0 && (
          <div className="mt-4 pt-4 border-t border-slate-100">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">🎯 CTP Winners</p>
            <div className="flex flex-wrap gap-2">
              {round.ctpWinners.map((c) => (
                <Badge key={c.id} className="bg-orange-100 text-orange-800 border border-orange-200 hover:bg-orange-100">
                  Hole {c.hole}: {c.playerName}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Championship round ────────────────────────────────────────────────────────

function ChampionshipResults({ round, poolSummaries }: { round: RoundData; poolSummaries: PoolSummary[] }) {
  const bluePools = poolSummaries.filter((w) => ["A", "B"].includes(w.pool));
  const redPools = poolSummaries.filter((w) => ["C", "D"].includes(w.pool));

  return (
    <Card className="border-amber-300 bg-gradient-to-br from-amber-50 to-white">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🏆</span>
            <div>
              <CardTitle className="text-xl text-slate-900">Championship Results</CardTitle>
              <p className="text-sm text-slate-500 mt-0.5">{formatDate(round.date)} · {round._count.results} players</p>
            </div>
          </div>
          <Link href={`/rounds/${round.id}`} className="text-sm text-green-700 hover:text-green-900 hover:underline transition-colors">
            Full scorecard →
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid md:grid-cols-2 gap-6">
          <PoolColumn label="🔵 Blue Division" pools={bluePools} />
          <PoolColumn label="🔴 Red Division" pools={redPools} />
        </div>
        {round.ctpWinners.length > 0 && (
          <div className="mt-4 pt-4 border-t border-amber-100">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">🎯 CTP Winners</p>
            <div className="flex flex-wrap gap-2">
              {round.ctpWinners.map((c) => (
                <Badge key={c.id} className="bg-orange-100 text-orange-800 border border-orange-200 hover:bg-orange-100">
                  Hole {c.hole}: {c.playerName}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PoolColumn({ label, pools }: { label: string; pools: PoolSummary[] }) {
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
                    w.first.relativeScore < 0 ? "text-emerald-600" : w.first.relativeScore > 0 ? "text-orange-500" : "text-slate-500"
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
                    w.second.relativeScore < 0 ? "text-emerald-600" : w.second.relativeScore > 0 ? "text-orange-500" : "text-slate-500"
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
    <Card className="border-slate-200 bg-white">
      <CardContent className="pt-4 pb-4">
        <div className="text-2xl font-bold text-slate-900 tabular-nums">{value}</div>
        <div className="text-xs text-slate-500 mt-0.5">{label}</div>
      </CardContent>
    </Card>
  );
}
