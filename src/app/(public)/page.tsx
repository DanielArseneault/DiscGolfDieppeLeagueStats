import { prisma } from "@/lib/db";
import { getStandings } from "@/lib/standings";
import { computePoolSummaries, PoolSummary } from "@/lib/pool-utils";
import { computeHoleStats } from "@/lib/course-stats";
import { StandingsTable } from "@/components/standings-table";
import { CourseStatsTable } from "@/components/course-stats-tabs";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Division } from "@/generated/prisma/client";
import { formatDate, formatScore } from "@/lib/utils";
import Link from "next/link";

export const revalidate = 60;

type League = Awaited<ReturnType<typeof prisma.league.findMany>>[number];

async function getData(league: League) {
  const [standings, recentRound, qualifyingRoundsPlayed, allResults] = await Promise.all([
    getStandings(league.id),
    prisma.round.findFirst({
      where: { leagueId: league.id },
      orderBy: { weekNumber: "desc" },
      include: {
        results: {
          include: { player: true },
          orderBy: [{ division: "asc" }, { position: "asc" }],
        },
        roundWinners: { orderBy: [{ division: "asc" }, { place: "asc" }] },
        ctpWinners: { orderBy: { hole: "asc" } },
        poolWinners: { orderBy: [{ pool: "asc" }, { place: "asc" }] },
        blueLayout: { include: { holePars: { orderBy: { holeNumber: "asc" } } } },
        redLayout: { include: { holePars: { orderBy: { holeNumber: "asc" } } } },
        bobTag: true,
        _count: { select: { results: true } },
      },
    }),
    prisma.round.count({ where: { leagueId: league.id, isChampionship: false } }),
    prisma.result.findMany({
      where: { round: { leagueId: league.id } },
      select: { division: true, holeScores: true },
    }),
  ]);

  const poolSummaries: PoolSummary[] = recentRound?.isChampionship
    ? computePoolSummaries(recentRound.results, standings, recentRound.poolWinners)
    : [];

  const blueLeagueStats = recentRound?.blueLayout
    ? computeHoleStats(
        allResults.filter((r) => r.division === Division.BLUE).map((r) => r.holeScores as Record<string, number>),
        recentRound.blueLayout.holePars
      )
    : null;
  const redLeagueStats = recentRound?.redLayout
    ? computeHoleStats(
        allResults.filter((r) => r.division === Division.RED).map((r) => r.holeScores as Record<string, number>),
        recentRound.redLayout.holePars
      )
    : null;

  return { league, standings, recentRound, qualifyingRoundsPlayed, poolSummaries, blueLeagueStats, redLeagueStats };
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

  const { league, standings, recentRound, qualifyingRoundsPlayed, poolSummaries, blueLeagueStats, redLeagueStats } = data;

  const playerLookup = new Map(
    (recentRound?.results ?? []).map((r) => [r.player.name.toLowerCase().trim(), r.player.id])
  );

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
          <div className="relative flex flex-col md:flex-row md:items-end gap-5 md:gap-8">
            <div className="flex-1">
              <p className="text-white/60 text-xs font-semibold uppercase tracking-widest mb-1">Standings</p>
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tight drop-shadow-sm">{league.name}</h1>
              {league.shortName && (
                <p className="text-white/70 text-base mt-1 font-medium">{league.shortName}</p>
              )}
              <p className="text-white/80 mt-2 text-sm">
                {formatDate(league.startDate)} – {formatDate(league.endDate)} · {league.location}
              </p>
              {allLeagues.length > 1 && (
                <div className="flex items-center gap-2 mt-3">
                  <span className="text-white/40 text-xs">Season:</span>
                  {allLeagues.map((l) => (
                    <a
                      key={l.id}
                      href={`/?league=${l.id}`}
                      className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                        l.id === league.id
                          ? "bg-white/20 border-white/40 text-white font-medium"
                          : "border-white/20 text-white/40 hover:text-white/80 hover:border-white/30"
                      }`}
                    >
                      {l.year}
                    </a>
                  ))}
                </div>
              )}
              {league.facebookUrl && (
                <a
                  href={league.facebookUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 mt-4 px-4 py-2 rounded-full bg-white/15 hover:bg-white/25 border border-white/30 text-white text-sm font-medium transition-colors backdrop-blur-sm"
                >
                  <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                  </svg>
                  {league.facebookLabel ?? "More Info"}
                </a>
              )}
            </div>
            {/* Sponsor logo */}
            <div className="flex-shrink-0 self-start md:self-end">
              <a
                href="https://fundyflightdiscs.ca/"
                target="_blank"
                rel="noopener noreferrer"
                className="bg-white rounded-2xl shadow-xl px-4 pt-3 pb-4 flex flex-col items-center gap-2 hover:shadow-2xl transition-shadow"
              >
                <p className="text-[#1a3355] text-xs font-semibold uppercase tracking-widest">Presented by</p>
                <div className="bg-[#1a3355] rounded-full p-1">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/FFD_Logo.avif"
                    alt="Fundy Flight Discs"
                    className="w-14 md:w-24 h-auto rounded-full"
                  />
                </div>
              </a>
            </div>
          </div>
        </div>
        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1200 56" preserveAspectRatio="none" className="w-full h-8 md:h-14 fill-[#f8fafc]">
            <path d="M0,56 L0,28 C150,56 300,8 500,22 C700,36 900,4 1200,22 L1200,56 Z" />
          </svg>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 md:gap-4">
        <StatCard label="Blue Division" value={blueCount} variant="blue" />
        <StatCard label="Red Division" value={redCount} variant="red" />
        <StatCard label="Qualified" value={qualifiedCount} total={blueCount + redCount} />
        <StatCard label="Rounds Played" value={qualifyingRoundsPlayed} total={league.qualifyingWeeks} />
      </div>

      {recentRound && (
        recentRound.isChampionship
          ? <ChampionshipResults round={recentRound} poolSummaries={poolSummaries} leagueId={league.id} playerLookup={playerLookup} />
          : <RecentRound round={recentRound} leagueId={league.id} playerLookup={playerLookup} />
      )}

      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-slate-900">
            {recentRound?.isChampionship ? "Final Standings" : "Season Standings"}
          </h2>
          <Link href={`/rounds?league=${league.id}`} className="text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 hover:border-blue-300 px-3 py-1 rounded-full transition-colors">
            All rounds →
          </Link>
        </div>
        <Card className="border-slate-200">
          <CardContent className="pt-6">
            <p className="text-xs text-slate-500 mb-4">
              Best {league.bestScoresCount} of {league.qualifyingWeeks} qualifying rounds counted · Minimum {league.minWeeks} rounds to qualify
            </p>
            <Tabs defaultValue="blue">
              <TabsList className="mb-4">
                <TabsTrigger value="blue">🔵 Blue Division</TabsTrigger>
                <TabsTrigger value="red">🔴 Red Division</TabsTrigger>
              </TabsList>
              <TabsContent value="blue">
                <StandingsTable standings={standings} division={Division.BLUE} bestScoresCount={league.bestScoresCount} leagueId={league.id} />
              </TabsContent>
              <TabsContent value="red">
                <StandingsTable standings={standings} division={Division.RED} bestScoresCount={league.bestScoresCount} leagueId={league.id} />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      {(blueLeagueStats || redLeagueStats) && (
        <div>
          <h2 className="text-xl font-semibold text-slate-900 mb-4">Course Stats</h2>
          <Card className="border-slate-200">
            <CardContent className="pt-6">
              <Tabs defaultValue={blueLeagueStats ? "blue" : "red"}>
                <TabsList className="mb-4">
                  {blueLeagueStats && <TabsTrigger value="blue">🔵 Blue Division</TabsTrigger>}
                  {redLeagueStats && <TabsTrigger value="red">🔴 Red Division</TabsTrigger>}
                </TabsList>
                {blueLeagueStats && (
                  <TabsContent value="blue">
                    <CourseStatsTable stats={blueLeagueStats} />
                  </TabsContent>
                )}
                {redLeagueStats && (
                  <TabsContent value="red">
                    <CourseStatsTable stats={redLeagueStats} />
                  </TabsContent>
                )}
              </Tabs>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

// ── Normal round ──────────────────────────────────────────────────────────────

type GetDataResult = NonNullable<Awaited<ReturnType<typeof getData>>>;
type RoundData = NonNullable<GetDataResult["recentRound"]>;
type PlayerLookup = Map<string, number>;

function PlayerName({ name, lookup, leagueId, className }: { name: string; lookup: PlayerLookup; leagueId: number; className?: string }) {
  const id = lookup.get(name.toLowerCase().trim());
  if (!id) return <span className={className}>{name}</span>;
  return <Link href={`/players/${id}?league=${leagueId}`} className={`hover:underline ${className ?? ""}`}>{name}</Link>;
}

function RecentRound({ round, leagueId, playerLookup }: { round: RoundData; leagueId: number; playerLookup: PlayerLookup }) {
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
            const overrideWinner = round.roundWinners.find((w) => w.division === div && w.place === 1);
            return (
              <div key={div}>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">
                  {div === Division.BLUE ? "🔵 Blue Division" : "🔴 Red Division"}
                </p>
                {top3.length === 0 ? (
                  <p className="text-slate-400 text-sm">No results</p>
                ) : (
                  <ol className="space-y-1">
                    {top3.map((r, i) => {
                      const displayName = i === 0 && overrideWinner ? overrideWinner.playerName : r.player.name;
                      const playerId = i === 0 && overrideWinner
                        ? playerLookup.get(overrideWinner.playerName.toLowerCase().trim()) ?? r.player.id
                        : r.player.id;
                      return (
                        <li key={r.id} className="flex items-center gap-3 text-sm">
                          <span className="text-slate-400 w-4 text-right">{i + 1}.</span>
                          <Link href={`/players/${playerId}?league=${leagueId}`} className="font-medium text-slate-900 hover:underline">
                            {displayName}
                          </Link>
                          <span className={`ml-auto font-mono text-xs ${
                            r.relativeScore < 0 ? "text-emerald-600" : r.relativeScore > 0 ? "text-orange-500" : "text-slate-500"
                          }`}>
                            {r.score} ({formatScore(r.relativeScore)})
                          </span>
                        </li>
                      );
                    })}
                  </ol>
                )}
              </div>
            );
          })}
        </div>
        {round.ctpWinners.length > 0 && (
          <div className="mt-4 pt-4 border-t border-slate-100">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">🎯 CTP Winners</p>
            <div className="space-y-1.5">
              {round.ctpWinners.map((c) => (
                <div key={c.id} className="flex items-center gap-1.5 flex-wrap">
                  <Badge className="bg-orange-100 text-orange-800 border border-orange-200 hover:bg-orange-100">
                    🎯 Hole {c.hole}: <PlayerName name={c.playerName} lookup={playerLookup} leagueId={leagueId} className="font-semibold hover:underline" />
                  </Badge>
                  {c.prize && (
                    <Badge className="bg-amber-100 text-amber-800 border border-amber-200 hover:bg-amber-100">
                      🏅 {c.prize}
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
        {round.bobTag && (
          <div className="mt-4 pt-4 border-t border-slate-100">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">🚌 BOB Tag</p>
            <PlayerName name={round.bobTag.playerName} lookup={playerLookup} leagueId={leagueId} className="text-sm font-semibold text-slate-800 hover:underline" />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Championship round ────────────────────────────────────────────────────────

function ChampionshipResults({ round, poolSummaries, leagueId, playerLookup }: { round: RoundData; poolSummaries: PoolSummary[]; leagueId: number; playerLookup: PlayerLookup }) {
  const bluePools = poolSummaries.filter((w) => ["A", "B"].includes(w.pool));
  const redPools = poolSummaries.filter((w) => ["C", "D"].includes(w.pool));

  return (
    <Card className="border-amber-300 bg-gradient-to-br from-amber-50 to-white">
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 sm:gap-3">
          <div className="flex items-start gap-2 min-w-0">
            <span className="text-2xl shrink-0 mt-0.5">🏆</span>
            <div className="min-w-0">
              <CardTitle className="text-xl text-slate-900">Championship Results</CardTitle>
              <p className="text-sm text-slate-500 mt-0.5">{formatDate(round.date)} · {round._count.results} players</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {round.facebookUrl && (
              <a
                href={round.facebookUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 px-3 py-1 rounded-full transition-colors"
              >
                {round.facebookLabel ?? "Recap"} ↗
              </a>
            )}
            <Link href={`/rounds/${round.id}?league=${leagueId}`} className="text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 hover:border-blue-300 px-3 py-1 rounded-full transition-colors">
              Full scorecard →
            </Link>
            <div className="flex items-center gap-2">
              {round.results.filter((r) => r.division === Division.BLUE).length > 0 && (
                <span className="text-sm text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-0.5 rounded-full">
                  🔵 {round.results.filter((r) => r.division === Division.BLUE).length}
                </span>
              )}
              {round.results.filter((r) => r.division === Division.RED).length > 0 && (
                <span className="text-sm text-red-700 bg-red-50 border border-red-200 px-2.5 py-0.5 rounded-full">
                  🔴 {round.results.filter((r) => r.division === Division.RED).length}
                </span>
              )}
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid md:grid-cols-2 gap-4 md:gap-6">
          <PoolColumn label="🔵 Blue Division" pools={bluePools} playerLookup={playerLookup} leagueId={leagueId} />
          <PoolColumn label="🔴 Red Division" pools={redPools} playerLookup={playerLookup} leagueId={leagueId} />
        </div>
        {round.ctpWinners.length > 0 && (
          <div className="mt-4 pt-4 border-t border-amber-100">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">🎯 CTP Winners</p>
            <div className="space-y-1.5">
              {round.ctpWinners.map((c) => (
                <div key={c.id} className="flex items-center gap-1.5 flex-wrap">
                  <Badge className="bg-orange-100 text-orange-800 border border-orange-200 hover:bg-orange-100">
                    🎯 Hole {c.hole}: <PlayerName name={c.playerName} lookup={playerLookup} leagueId={leagueId} className="font-semibold hover:underline" />
                  </Badge>
                  {c.prize && (
                    <Badge className="bg-amber-100 text-amber-800 border border-amber-200 hover:bg-amber-100">
                      🏅 {c.prize}
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PoolColumn({ label, pools, playerLookup, leagueId }: { label: string; pools: PoolSummary[]; playerLookup: PlayerLookup; leagueId: number }) {
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
                  <span className="text-base shrink-0">🥇</span>
                  <PlayerName name={w.first.playerName} lookup={playerLookup} leagueId={leagueId} className="font-semibold text-slate-900 text-sm hover:underline min-w-0 truncate" />
                  {w.first.prize && (
                    <Badge className="hidden sm:inline-flex bg-amber-100 text-amber-800 border border-amber-200 hover:bg-amber-100 text-xs shrink-0">🏅 {w.first.prize}</Badge>
                  )}
                  <span className={`ml-auto font-mono text-xs shrink-0 ${
                    w.first.relativeScore < 0 ? "text-emerald-600" : w.first.relativeScore > 0 ? "text-orange-500" : "text-slate-500"
                  }`}>
                    {w.first.score} ({formatScore(w.first.relativeScore)})
                  </span>
                </div>
              )}
              {w.second && (
                <div className="flex items-center gap-2">
                  <span className="text-base shrink-0">🥈</span>
                  <PlayerName name={w.second.playerName} lookup={playerLookup} leagueId={leagueId} className="text-slate-700 text-sm hover:underline min-w-0 truncate" />
                  {w.second.prize && (
                    <Badge className="hidden sm:inline-flex bg-amber-100 text-amber-800 border border-amber-200 hover:bg-amber-100 text-xs shrink-0">🏅 {w.second.prize}</Badge>
                  )}
                  <span className={`ml-auto font-mono text-xs shrink-0 ${
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

function StatCard({ label, value, total, variant }: { label: string; value: number; total?: number; variant?: "blue" | "red" }) {
  const accent = variant === "blue" ? "border-l-4 border-l-blue-400" : variant === "red" ? "border-l-4 border-l-red-400" : "";
  return (
    <Card className={`border-slate-200 bg-white ${accent}`}>
      <CardContent className="pt-4 pb-4">
        <div className="text-2xl font-bold text-slate-900 tabular-nums">
          {value}
          {total !== undefined && (
            <span className="text-base font-normal text-slate-400"> / {total}</span>
          )}
        </div>
        <div className="text-xs text-slate-500 mt-0.5">{label}</div>
      </CardContent>
    </Card>
  );
}
