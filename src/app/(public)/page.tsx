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

type League = Awaited<ReturnType<typeof prisma.league.findMany>>[number];

async function getData(league: League) {
  const [standings, recentRound, qualifyingRoundsPlayed] = await Promise.all([
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
  ]);

  const poolSummaries: PoolSummary[] = recentRound?.isChampionship
    ? computePoolSummaries(recentRound.results, standings, recentRound.poolWinners)
    : [];

  return { league, standings, recentRound, qualifyingRoundsPlayed, poolSummaries };
}

const emptyState = (
  <div className="text-center py-24">
    <div className="text-5xl mb-4">🥏</div>
    <h1 className="text-2xl font-bold text-slate-900 mb-2">Welcome to Dieppe DGC League</h1>
    <p className="text-slate-500">No league data yet. Visit the admin panel to get started.</p>
    <Link href="/admin" className="mt-4 inline-block text-sm text-blue-600 hover:text-blue-800 hover:underline">
      Go to Admin →
    </Link>
  </div>
);

export default async function HomePage({ searchParams }: { searchParams: Promise<{ league?: string }> }) {
  const { league: leagueParam } = await searchParams;
  const leagueId = leagueParam ? Number(leagueParam) : null;

  // When leagueId is known, run allLeagues and the league's data fetch in parallel.
  // When unknown, we need allLeagues first to discover the default.
  let allLeagues: League[];
  let data: Awaited<ReturnType<typeof getData>>;

  if (leagueId) {
    const [leagues, leagueRow] = await Promise.all([
      prisma.league.findMany({ orderBy: { year: "desc" } }),
      prisma.league.findUnique({ where: { id: leagueId } }),
    ]);
    allLeagues = leagues;
    if (allLeagues.length === 0) return emptyState;
    const selectedLeague = leagueRow ?? allLeagues[0];
    data = await getData(selectedLeague);
  } else {
    allLeagues = await prisma.league.findMany({ orderBy: { year: "desc" } });
    if (allLeagues.length === 0) return emptyState;
    data = await getData(allLeagues[0]);
  }

  const { league, standings, recentRound, qualifyingRoundsPlayed, poolSummaries } = data;

  const blueCount = standings.filter((s) => s.division === Division.BLUE).length;
  const redCount = standings.filter((s) => s.division === Division.RED).length;
  const qualifiedCount = standings.filter((s) => s.qualified).length;

  return (
    <div className="space-y-8">
      {/* Hero banner */}
      <div className="-mx-4 -mt-14 relative overflow-hidden mb-2">
        <div
          className="px-4 pt-16 pb-20 md:px-8 md:pt-24 md:pb-32 text-white relative bg-cover"
          style={{ backgroundImage: "url('/hero-basket.jpg')", backgroundPosition: "28% 30%" }}
        >
          {/* Dark overlay for text readability */}
          <div className="absolute inset-0 bg-gradient-to-br from-black/65 via-black/40 to-black/30 pointer-events-none" />
          {/* Extra scrim at top for nav legibility */}
          <div className="absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-black/40 to-transparent pointer-events-none" />
          <div className="relative">
            <p className="text-white/60 text-xs font-semibold uppercase tracking-widest mb-1">Standings</p>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tight drop-shadow-sm">{league.name}</h1>
            <p className="text-white/80 mt-2 text-sm">
              {formatDate(league.startDate)} – {formatDate(league.endDate)} · {league.location}
            </p>
          </div>
        </div>
        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1200 56" preserveAspectRatio="none" className="w-full h-8 md:h-14 fill-[#f8fafc]">
            <path d="M0,56 L0,28 C150,56 300,8 500,22 C700,36 900,4 1200,22 L1200,56 Z" />
          </svg>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 md:gap-4">
        <StatCard label="Blue Division Players" value={blueCount} />
        <StatCard label="Red Division Players" value={redCount} />
        <StatCard label="Players Qualified" value={qualifiedCount} />
        <StatCard label="Rounds Played" value={qualifyingRoundsPlayed} />
      </div>

      {recentRound && (
        recentRound.isChampionship
          ? <ChampionshipResults round={recentRound} poolSummaries={poolSummaries} leagueId={league.id} />
          : <RecentRound round={recentRound} leagueId={league.id} />
      )}

      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-slate-900">
            {recentRound?.isChampionship ? "Final Standings" : "Season Standings"}
          </h2>
          <Link href="/rounds" className="text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 hover:border-blue-300 px-3 py-1 rounded-full transition-colors">
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

type GetDataResult = NonNullable<Awaited<ReturnType<typeof getData>>>;
type RoundData = NonNullable<GetDataResult["recentRound"]>;

function RecentRound({ round, leagueId }: { round: RoundData; leagueId: number }) {
  return (
    <Card className="border-slate-200">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <CardTitle className="text-slate-900">Week {round.weekNumber} — Recent Results</CardTitle>
          <Link href={`/rounds/${round.id}?league=${leagueId}`} className="shrink-0 text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 hover:border-blue-300 px-3 py-1 rounded-full transition-colors">
            Full scorecard →
          </Link>
        </div>
        <p className="text-sm text-slate-500">
          {formatDate(round.date)} · {round._count.results} players
        </p>
      </CardHeader>
      <CardContent>
        <div className="grid md:grid-cols-2 gap-4 md:gap-6">
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

function ChampionshipResults({ round, poolSummaries, leagueId }: { round: RoundData; poolSummaries: PoolSummary[]; leagueId: number }) {
  const bluePools = poolSummaries.filter((w) => ["A", "B"].includes(w.pool));
  const redPools = poolSummaries.filter((w) => ["C", "D"].includes(w.pool));

  return (
    <Card className="border-amber-300 bg-gradient-to-br from-amber-50 to-white">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2 min-w-0">
            <span className="text-2xl shrink-0 mt-0.5">🏆</span>
            <div className="min-w-0">
              <CardTitle className="text-xl text-slate-900">Championship Results</CardTitle>
              <p className="text-sm text-slate-500 mt-0.5">{formatDate(round.date)} · {round._count.results} players</p>
            </div>
          </div>
          <Link href={`/rounds/${round.id}?league=${leagueId}`} className="shrink-0 text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 hover:border-blue-300 px-3 py-1 rounded-full transition-colors">
            Full scorecard →
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid md:grid-cols-2 gap-4 md:gap-6">
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
