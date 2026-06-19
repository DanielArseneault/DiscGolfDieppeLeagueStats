import { prisma } from "@/lib/db";
import { getStandings } from "@/lib/standings";
import { computePoolSummaries, PoolSummary } from "@/lib/pool-utils";
import { computeHoleStats } from "@/lib/course-stats";
import { notFound } from "next/navigation";
import { ScorecardTable } from "@/components/scorecard-table";
import { ScorecardTabs } from "@/components/scorecard-tabs";
import { CourseStatsSection } from "@/components/course-stats-tabs";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Division } from "@/generated/prisma/client";
import { formatDate, formatScore } from "@/lib/utils";
import Link from "next/link";

export const revalidate = 60;

type ResultRow = {
  position: number;
  playerName: string;
  playerId?: number;
  score: number;
  relativeScore: number;
  holeScores: Record<string, number>;
};

function assignPositions(rows: ResultRow[]): ResultRow[] {
  const sorted = [...rows].sort((a, b) => a.relativeScore - b.relativeScore);
  let rank = 1;
  return sorted.map((r, i) => {
    if (i > 0 && sorted[i].relativeScore > sorted[i - 1].relativeScore) rank = i + 1;
    return { ...r, position: rank };
  });
}

export default async function RoundPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ league?: string }>;
}) {
  const { id } = await params;
  const { league: leagueParam } = await searchParams;
  const backUrl = leagueParam ? `/rounds?league=${leagueParam}` : "/rounds";

  const round = await prisma.round.findUnique({
    where: { id: Number(id) },
    include: {
      results: {
        include: { player: true },
        orderBy: [{ division: "asc" }, { position: "asc" }],
      },
      roundWinners: { orderBy: [{ division: "asc" }, { place: "asc" }] },
      ctpWinners: { orderBy: { hole: "asc" } },
      aceWinners: { orderBy: { hole: "asc" } },
      poolWinners: { orderBy: [{ pool: "asc" }, { place: "asc" }] },
      blueLayout: { include: { holePars: { orderBy: { holeNumber: "asc" } } } },
      redLayout: { include: { holePars: { orderBy: { holeNumber: "asc" } } } },
      league: true,
    },
  });

  if (!round) notFound();

  // Build name→id lookup from this round's results
  const playerLookup = new Map(
    round.results.map((r) => [r.player.name.toLowerCase().trim(), r.player.id])
  );

  const blueResults = round.results.filter((r) => r.division === Division.BLUE);
  const redResults = round.results.filter((r) => r.division === Division.RED);

  // Build pool data for championship rounds
  type PoolGroup = { pool: string; label: string; rows: ResultRow[] };
  let poolGroups: PoolGroup[] = [];
  let blueUnqualified: ResultRow[] = [];
  let redUnqualified: ResultRow[] = [];
  let poolSummaries: PoolSummary[] = [];

  if (round.isChampionship) {
    const standings = await getStandings(round.leagueId);

    poolSummaries = computePoolSummaries(round.results, standings, round.poolWinners);

    const playerPoolMap = new Map<number, string>();
    for (const s of standings) {
      if (s.championshipPool) playerPoolMap.set(s.playerId, s.championshipPool);
    }

    const groups: Record<string, ResultRow[]> = { A: [], B: [], C: [], D: [] };

    for (const result of round.results) {
      const pool = playerPoolMap.get(result.playerId);
      const row: ResultRow = {
        position: result.position,
        playerName: result.player.name,
        playerId: result.playerId,
        score: result.score,
        relativeScore: result.relativeScore,
        holeScores: result.holeScores as Record<string, number>,
      };
      if (pool) {
        groups[pool].push(row);
      } else if (result.division === Division.BLUE) {
        blueUnqualified.push(row);
      } else {
        redUnqualified.push(row);
      }
    }

    const poolLabels: Record<string, string> = {
      A: "🔵 Pool A", B: "🔵 Pool B", C: "🔴 Pool C", D: "🔴 Pool D",
    };

    poolGroups = (["A", "B", "C", "D"] as const)
      .filter((p) => groups[p].length > 0)
      .map((p) => ({ pool: p, label: poolLabels[p], rows: assignPositions(groups[p]) }));

    blueUnqualified = assignPositions(blueUnqualified);
    redUnqualified = assignPositions(redUnqualified);
  }

  const blueSummaries = poolSummaries.filter((w) => ["A", "B"].includes(w.pool));
  const redSummaries = poolSummaries.filter((w) => ["C", "D"].includes(w.pool));

  return (
    <div className="space-y-6">
      {/* Hero banner */}
      <div className="-mx-4 -mt-14 relative overflow-hidden mb-2">
        <div
          className="px-4 pt-16 pb-20 md:px-8 md:pt-24 md:pb-32 text-white relative bg-cover"
          style={{ backgroundImage: "url('/hero-rounds.jpg')", backgroundPosition: "50% 40%" }}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-black/65 via-black/40 to-black/30 pointer-events-none" />
          <div className="absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-black/40 to-transparent pointer-events-none" />
          <div className="relative">
            <div className="flex items-center gap-2 text-white/60 text-xs font-semibold uppercase tracking-widest mb-1">
              <Link href={backUrl} className="hover:text-white/90 transition-colors">Rounds</Link>
              <span>/</span>
              <span>{round.isChampionship ? "Championship" : `Week ${round.weekNumber}`}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tight drop-shadow-sm">
              {round.isChampionship ? "🏆 Championship" : `Week ${round.weekNumber}`}
            </h1>
            <p className="text-white/80 mt-2 text-sm">
              {formatDate(round.date)} · {round.league.name}
            </p>
            {round.facebookUrl && (
              <a
                href={round.facebookUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 mt-4 px-4 py-2 rounded-full bg-white/15 hover:bg-white/25 border border-white/30 text-white text-sm font-medium transition-colors backdrop-blur-sm"
              >
                <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
                {round.facebookLabel ?? "More Info"}
              </a>
            )}
          </div>
        </div>
        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1200 56" preserveAspectRatio="none" className="w-full h-8 md:h-14 fill-[#f8fafc]">
            <path d="M0,56 L0,28 C150,56 300,8 500,22 C700,36 900,4 1200,22 L1200,56 Z" />
          </svg>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card className="border-slate-200">
          <CardContent className="pt-4 pb-4">
            <div className="text-2xl font-bold text-slate-900 tabular-nums">{round.results.length}</div>
            <div className="text-xs text-slate-500">Total Players</div>
          </CardContent>
        </Card>
        <Card className="border-slate-200">
          <CardContent className="pt-4 pb-4">
            <div className="text-2xl font-bold text-slate-900 tabular-nums">{blueResults.length}</div>
            <div className="text-xs text-slate-500">Blue Division</div>
          </CardContent>
        </Card>
        <Card className="border-slate-200">
          <CardContent className="pt-4 pb-4">
            <div className="text-2xl font-bold text-slate-900 tabular-nums">{redResults.length}</div>
            <div className="text-xs text-slate-500">Red Division</div>
          </CardContent>
        </Card>
      </div>

      {round.isChampionship && poolSummaries.length > 0 && (
        <Card className="border-amber-300 bg-gradient-to-br from-amber-50 to-white">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <span className="text-2xl">🏆</span>
              <CardTitle className="text-xl text-slate-900">Pool Results</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-6">
              <PoolSummaryColumn label="🔵 Blue Division" pools={blueSummaries} playerLookup={playerLookup} leagueId={round.leagueId} />
              <PoolSummaryColumn label="🔴 Red Division" pools={redSummaries} playerLookup={playerLookup} leagueId={round.leagueId} />
            </div>
          </CardContent>
        </Card>
      )}

      {!round.isChampionship && (
        (() => {
          const sections = ([Division.BLUE, Division.RED] as Division[]).map((div) => {
            const divResults = round.results.filter((r) => r.division === div);
            const savedFirst = round.roundWinners.find((w) => w.division === div && w.place === 1);
            const firstName = savedFirst?.playerName ?? divResults.find((r) => r.position === 1)?.player.name;
            const firstPrize = savedFirst?.prize ?? null;
            const savedSeconds = round.roundWinners.filter((w) => w.division === div && w.place === 2);
            // Fall back to scorecard position-2 players if no overrides saved
            const seconds: { id: number; playerName: string }[] = savedSeconds.length > 0
              ? savedSeconds
              : divResults.filter((r) => r.position === 2).map((r) => ({ id: r.id, playerName: r.player.name }));
            return { div, firstName, firstPrize, seconds };
          });
          const hasAny = sections.some((s) => s.firstName || s.seconds.length > 0);
          if (!hasAny) return null;
          return (
            <Card className="border-emerald-300 bg-gradient-to-br from-emerald-50 to-white">
              <CardHeader className="pb-3">
                <CardTitle className="text-base text-slate-900">🥇 Round Winners</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid sm:grid-cols-2 gap-x-6 gap-y-3">
                  {sections.map(({ div, firstName, firstPrize, seconds }) => {
                    if (!firstName && seconds.length === 0) return null;
                    return (
                      <div key={div}>
                        <p className="text-xs font-semibold uppercase tracking-wide mb-2 text-slate-400">
                          {div === Division.BLUE ? "🔵 Blue Division" : "🔴 Red Division"}
                        </p>
                        <div className="space-y-1.5">
                          {firstName && (
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-base shrink-0">🥇</span>
                              <PlayerName name={firstName} lookup={playerLookup} leagueId={round.leagueId} className="font-semibold text-slate-800 text-sm hover:underline" />
                              {firstPrize && (
                                <Badge className="bg-amber-100 text-amber-800 border border-amber-200 hover:bg-amber-100 text-xs">
                                  🏅 {firstPrize}
                                </Badge>
                              )}
                            </div>
                          )}
                          {seconds.map((w) => (
                            <div key={w.id} className="flex items-center gap-2">
                              <span className="text-base shrink-0">🥈</span>
                              <PlayerName name={w.playerName} lookup={playerLookup} leagueId={round.leagueId} className="font-semibold text-slate-800 text-sm hover:underline" />
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          );
        })()
      )}

      {round.ctpWinners.length > 0 && (
        <Card className="border-green-200">
          <CardHeader>
            <CardTitle className="text-base text-slate-900">🎯 CTP Winners</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {round.ctpWinners.map((c) => (
                <div key={c.id} className="flex items-center gap-1.5 flex-wrap">
                  <Badge className="bg-orange-100 text-orange-800 border border-orange-200 hover:bg-orange-100 text-sm">
                    🎯 Hole {c.hole}: <PlayerName name={c.playerName} lookup={playerLookup} leagueId={round.leagueId} className="font-semibold hover:underline" />
                  </Badge>
                  {c.prize && (
                    <Badge className="bg-amber-100 text-amber-800 border border-amber-200 hover:bg-amber-100 text-sm">
                      🏅 {c.prize}
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {round.aceWinners.length > 0 && (
        <Card className="border-purple-200 bg-gradient-to-br from-purple-50 to-white">
          <CardHeader>
            <CardTitle className="text-base text-slate-900">🦅 Ace Winners</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {round.aceWinners.map((a) => (
                <Badge key={a.id} className="bg-purple-100 text-purple-800 border border-purple-200 hover:bg-purple-100 text-sm">
                  Hole {a.hole}: <PlayerName name={a.playerName} lookup={playerLookup} leagueId={round.leagueId} className="font-semibold hover:underline" />{a.prizeAmount != null ? ` · $${a.prizeAmount.toFixed(2)}` : ""}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <ScorecardTabs
        blueLabel="🔵 Blue Division"
        redLabel="🔴 Red Division"
        blueContent={blueResults.length > 0 ? (
          <>
            {round.isChampionship
              ? poolGroups.filter((g) => ["A", "B"].includes(g.pool)).map((g) => (
                  <ScorecardTable
                    key={g.pool}
                    divisionLabel={g.label}
                    results={g.rows}
                    holePars={round.blueLayout?.holePars ?? []}
                    leagueId={round.leagueId}
                  />
                ))
              : (
                <ScorecardTable
                  divisionLabel="🔵 Blue Division"
                  results={blueResults.map((r) => ({
                    position: r.position,
                    playerName: r.player.name,
                    playerId: r.playerId,
                    score: r.score,
                    relativeScore: r.relativeScore,
                    holeScores: r.holeScores as Record<string, number>,
                  }))}
                  holePars={round.blueLayout?.holePars ?? []}
                  leagueId={round.leagueId}
                />
              )
            }
            {blueUnqualified.length > 0 && (
              <ScorecardTable
                divisionLabel="🔵 Blue — Did Not Qualify"
                results={blueUnqualified}
                holePars={round.blueLayout?.holePars ?? []}
                leagueId={round.leagueId}
              />
            )}
            {round.blueLayout && (
              <CourseStatsSection
                stats={computeHoleStats(
                  blueResults.map((r) => r.holeScores as Record<string, number>),
                  round.blueLayout.holePars
                )}
              />
            )}
          </>
        ) : undefined}
        redContent={redResults.length > 0 ? (
          <>
            {round.isChampionship
              ? poolGroups.filter((g) => ["C", "D"].includes(g.pool)).map((g) => (
                  <ScorecardTable
                    key={g.pool}
                    divisionLabel={g.label}
                    results={g.rows}
                    holePars={round.redLayout?.holePars ?? []}
                    leagueId={round.leagueId}
                  />
                ))
              : (
                <ScorecardTable
                  divisionLabel="🔴 Red Division"
                  results={redResults.map((r) => ({
                    position: r.position,
                    playerName: r.player.name,
                    playerId: r.playerId,
                    score: r.score,
                    relativeScore: r.relativeScore,
                    holeScores: r.holeScores as Record<string, number>,
                  }))}
                  holePars={round.redLayout?.holePars ?? []}
                  leagueId={round.leagueId}
                />
              )
            }
            {redUnqualified.length > 0 && (
              <ScorecardTable
                divisionLabel="🔴 Red — Did Not Qualify"
                results={redUnqualified}
                holePars={round.redLayout?.holePars ?? []}
                leagueId={round.leagueId}
              />
            )}
            {round.redLayout && (
              <CourseStatsSection
                stats={computeHoleStats(
                  redResults.map((r) => r.holeScores as Record<string, number>),
                  round.redLayout.holePars
                )}
              />
            )}
          </>
        ) : undefined}
      />
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function PlayerName({ name, lookup, leagueId, className }: { name: string; lookup: Map<string, number>; leagueId: number; className?: string }) {
  const id = lookup.get(name.toLowerCase().trim());
  if (!id) return <span className={className}>{name}</span>;
  return <Link href={`/players/${id}?league=${leagueId}`} className={`hover:underline ${className ?? ""}`}>{name}</Link>;
}

function PoolSummaryColumn({ label, pools, playerLookup, leagueId }: { label: string; pools: PoolSummary[]; playerLookup: Map<string, number>; leagueId: number }) {
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
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-base">🥇</span>
                    <PlayerName name={w.first.playerName} lookup={playerLookup} leagueId={leagueId} className="font-semibold text-slate-900 text-sm hover:underline" />
                    <span className={`ml-auto font-mono text-xs ${
                      w.first.relativeScore < 0 ? "text-emerald-600" : w.first.relativeScore > 0 ? "text-orange-500" : "text-slate-500"
                    }`}>
                      {w.first.score} ({formatScore(w.first.relativeScore)})
                    </span>
                  </div>
                  {w.first.prize && (
                    <div className="pl-7">
                      <Badge className="bg-amber-100 text-amber-800 border border-amber-200 hover:bg-amber-100 text-xs">🏅 {w.first.prize}</Badge>
                    </div>
                  )}
                </div>
              )}
              {w.second && (
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-base">🥈</span>
                    <PlayerName name={w.second.playerName} lookup={playerLookup} leagueId={leagueId} className="text-slate-700 text-sm hover:underline" />
                    <span className={`ml-auto font-mono text-xs ${
                      w.second.relativeScore < 0 ? "text-emerald-600" : w.second.relativeScore > 0 ? "text-orange-500" : "text-slate-500"
                    }`}>
                      {w.second.score} ({formatScore(w.second.relativeScore)})
                    </span>
                  </div>
                  {w.second.prize && (
                    <div className="pl-7">
                      <Badge className="bg-amber-100 text-amber-800 border border-amber-200 hover:bg-amber-100 text-xs">🏅 {w.second.prize}</Badge>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
