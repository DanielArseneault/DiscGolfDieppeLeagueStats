import { prisma } from "@/lib/db";
import { getStandings } from "@/lib/standings";
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
  if (!league) return { league: null, standings: [], recentRound: null };

  const [standings, recentRound] = await Promise.all([
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
        _count: { select: { results: true } },
      },
    }),
  ]);

  return { league, standings, recentRound };
}

export default async function HomePage() {
  const { league, standings, recentRound } = await getData();

  if (!league) {
    return (
      <div className="text-center py-24">
        <div className="text-5xl mb-4">🥏</div>
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Welcome to Dieppe DGC League</h1>
        <p className="text-slate-500">No league data yet. Visit the admin panel to get started.</p>
        <Link href="/admin" className="mt-4 inline-block text-sm text-blue-600 hover:underline">
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
      <div>
        <h1 className="text-3xl font-bold text-slate-900">{league.name}</h1>
        <p className="text-slate-500 mt-1">
          {formatDate(league.startDate)} – {formatDate(league.endDate)} · {league.location}
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Blue Division" value={blueCount} />
        <StatCard label="Red Division" value={redCount} />
        <StatCard label="Qualified" value={qualifiedCount} />
        <StatCard label="Rounds Played" value={recentRound?.weekNumber ?? 0} />
      </div>

      {recentRound && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Week {recentRound.weekNumber} — Recent Results</CardTitle>
              <Link href={`/rounds/${recentRound.id}`} className="text-sm text-blue-600 hover:underline">
                Full scorecard →
              </Link>
            </div>
            <p className="text-sm text-slate-500">
              {formatDate(recentRound.date)} · {recentRound._count.results} players
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-6">
              {([Division.BLUE, Division.RED] as Division[]).map((div) => {
                const top3 = recentRound.results.filter((r) => r.division === div).slice(0, 3);
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
                            <span
                              className={`ml-auto font-mono text-xs ${
                                r.relativeScore < 0
                                  ? "text-emerald-600"
                                  : r.relativeScore > 0
                                  ? "text-red-500"
                                  : "text-slate-500"
                              }`}
                            >
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
            {recentRound.ctpWinners.length > 0 && (
              <div className="mt-4 pt-4 border-t border-slate-100">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">
                  🎯 CTP Winners
                </p>
                <div className="flex flex-wrap gap-2">
                  {recentRound.ctpWinners.map((c) => (
                    <Badge key={c.id} variant="secondary">
                      Hole {c.hole}: {c.playerName}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-slate-900">Season Standings</h2>
          <Link href="/rounds" className="text-sm text-blue-600 hover:underline">
            All rounds →
          </Link>
        </div>
        <Card>
          <CardContent className="pt-6">
            <Tabs defaultValue="blue">
              <TabsList className="mb-4">
                <TabsTrigger value="blue">🔵 Blue Division</TabsTrigger>
                <TabsTrigger value="red">🔴 Red Division</TabsTrigger>
              </TabsList>
              <TabsContent value="blue">
                <StandingsTable
                  standings={standings}
                  division={Division.BLUE}
                  bestScoresCount={league.bestScoresCount}
                />
              </TabsContent>
              <TabsContent value="red">
                <StandingsTable
                  standings={standings}
                  division={Division.RED}
                  bestScoresCount={league.bestScoresCount}
                />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
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
