import { prisma } from "@/lib/db";
import { getStandings } from "@/lib/standings";
import { computePoolSummaries, PoolSummary } from "@/lib/pool-utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatScore } from "@/lib/utils";
import Link from "next/link";
import { Division } from "@/generated/prisma/client";

export const revalidate = 60;

type Round = Awaited<ReturnType<typeof getRounds>>[number];

async function getRounds(leagueId: number) {
  return prisma.round.findMany({
    where: { leagueId },
    orderBy: { weekNumber: "desc" },
    include: {
      ctpWinners: { orderBy: { hole: "asc" } },
      poolWinners: { orderBy: [{ pool: "asc" }, { place: "asc" }] },
      results: {
        include: { player: true },
        orderBy: [{ division: "asc" }, { position: "asc" }],
      },
    },
  });
}

export default async function RoundsPage({ searchParams }: { searchParams: Promise<{ league?: string }> }) {
  const { league: leagueParam } = await searchParams;

  const leagues = await prisma.league.findMany({ orderBy: { year: "desc" } });
  if (leagues.length === 0) return <p className="text-slate-500">No leagues found.</p>;

  const selectedLeague = leagues.find((l) => l.id === Number(leagueParam)) ?? leagues[0];
  const rounds = await getRounds(selectedLeague.id);

  // Only fetch standings if there's a championship round — needed for pool assignment
  const hasChampionship = rounds.some((r) => r.isChampionship);
  const standings = hasChampionship ? await getStandings(selectedLeague.id) : [];

  return (
    <div className="space-y-6">
      {/* Hero banner */}
      <div className="-mx-4 -mt-14 relative overflow-hidden mb-2">
        <div
          className="px-8 pt-24 pb-32 text-white relative bg-cover"
          style={{ backgroundImage: "url('/hero-rounds.jpg')", backgroundPosition: "50% 40%" }}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-black/65 via-black/40 to-black/30 pointer-events-none" />
          <div className="absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-black/40 to-transparent pointer-events-none" />
          <div className="relative">
            <p className="text-white/60 text-xs font-semibold uppercase tracking-widest mb-1">Rounds</p>
            <h1 className="text-4xl font-black tracking-tight drop-shadow-sm">{selectedLeague.name}</h1>
            <p className="text-white/80 mt-2 text-sm">
              {formatDate(selectedLeague.startDate)} – {formatDate(selectedLeague.endDate)} · {selectedLeague.location}
            </p>
          </div>
        </div>
        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1200 56" preserveAspectRatio="none" className="w-full h-14 fill-[#f8fafc]">
            <path d="M0,56 L0,28 C150,56 300,8 500,22 C700,36 900,4 1200,22 L1200,56 Z" />
          </svg>
        </div>
      </div>

      {rounds.length === 0 ? (
        <p className="text-slate-500">No rounds recorded yet.</p>
      ) : (
        <div className="space-y-4">
          {rounds.map((round) =>
            round.isChampionship
              ? <ChampionshipCard key={round.id} round={round} standings={standings} leagueId={selectedLeague.id} />
              : <RegularRoundCard key={round.id} round={round} leagueId={selectedLeague.id} />
          )}
        </div>
      )}
    </div>
  );
}

// ── Regular round card ────────────────────────────────────────────────────────

function RegularRoundCard({ round, leagueId }: { round: Round; leagueId: number }) {
  const blueResults = round.results.filter((r) => r.division === Division.BLUE);
  const redResults = round.results.filter((r) => r.division === Division.RED);
  const blueLeader = blueResults.find((r) => r.position === 1);
  const redLeader = redResults.find((r) => r.position === 1);

  return (
    <Card className="hover:shadow-md hover:border-blue-200 transition-all border-slate-200">
      <CardContent className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-bold text-slate-900 mb-1">Week {round.weekNumber}</h3>
            <p className="text-sm text-slate-500 mb-4">
              {formatDate(round.date)}
              {blueResults.length > 0 && <span className="ml-3">🔵 {blueResults.length} Blue</span>}
              {redResults.length > 0 && <span className="ml-2">🔴 {redResults.length} Red</span>}
            </p>

            {(blueLeader || redLeader) && (
              <div className="grid sm:grid-cols-2 gap-3 mb-3">
                {blueLeader && (
                  <div className="bg-blue-50 rounded-lg px-4 py-2.5">
                    <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-1">🔵 Blue Leader</p>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-slate-900 text-sm truncate">{blueLeader.player.name}</span>
                      <span className={`font-mono text-xs font-semibold shrink-0 ${
                        blueLeader.relativeScore < 0 ? "text-emerald-600" : blueLeader.relativeScore > 0 ? "text-orange-500" : "text-slate-500"
                      }`}>
                        {formatScore(blueLeader.relativeScore)}
                      </span>
                    </div>
                  </div>
                )}
                {redLeader && (
                  <div className="bg-red-50 rounded-lg px-4 py-2.5">
                    <p className="text-xs font-semibold text-red-500 uppercase tracking-wide mb-1">🔴 Red Leader</p>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-slate-900 text-sm truncate">{redLeader.player.name}</span>
                      <span className={`font-mono text-xs font-semibold shrink-0 ${
                        redLeader.relativeScore < 0 ? "text-emerald-600" : redLeader.relativeScore > 0 ? "text-orange-500" : "text-slate-500"
                      }`}>
                        {formatScore(redLeader.relativeScore)}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {round.ctpWinners.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {round.ctpWinners.map((c) => (
                  <Badge key={c.id} className="bg-orange-100 text-orange-800 border border-orange-200 hover:bg-orange-100">
                    🎯 Hole {c.hole}: {c.playerName}
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <Link
            href={`/rounds/${round.id}?league=${leagueId}`}
            className="shrink-0 text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 hover:border-blue-300 px-3 py-1 rounded-full transition-colors"
          >
            Scorecard →
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Championship card ─────────────────────────────────────────────────────────

function ChampionshipCard({ round, standings, leagueId }: { round: Round; standings: Parameters<typeof computePoolSummaries>[1]; leagueId: number }) {
  const poolSummaries = computePoolSummaries(round.results, standings, round.poolWinners);
  const bluePools = poolSummaries.filter((s) => ["A", "B"].includes(s.pool));
  const redPools = poolSummaries.filter((s) => ["C", "D"].includes(s.pool));

  return (
    <Card className="border-amber-300 bg-gradient-to-br from-amber-50 to-white hover:shadow-md transition-all">
      <CardContent className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">

            {/* Header */}
            <div className="flex items-start gap-2 mb-4">
              <span className="text-2xl shrink-0 mt-0.5">🏆</span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-lg font-bold text-slate-900">Championship</h3>
                  <span className="text-xs bg-amber-200 text-amber-800 font-semibold px-2 py-0.5 rounded-full whitespace-nowrap">
                    Season Final
                  </span>
                </div>
                <p className="text-sm text-slate-500 mt-0.5">
                  {formatDate(round.date)} · {round.results.length} players
                </p>
              </div>
            </div>

            {/* Pool winners */}
            {(bluePools.length > 0 || redPools.length > 0) && (
              <div className="grid sm:grid-cols-2 gap-4 mb-3">
                {bluePools.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-2">🔵 Blue Division</p>
                    <div className="space-y-1.5">
                      {bluePools.map((s) => s.first && (
                        <div key={s.pool} className="flex items-center gap-2 bg-white border border-amber-200 rounded-lg px-3 py-2">
                          <span className="text-base">🥇</span>
                          <span className="text-xs font-semibold text-amber-700 w-14 shrink-0">Pool {s.pool}</span>
                          <span className="font-medium text-slate-900 text-sm truncate">{s.first.playerName}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {redPools.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-red-500 uppercase tracking-wide mb-2">🔴 Red Division</p>
                    <div className="space-y-1.5">
                      {redPools.map((s) => s.first && (
                        <div key={s.pool} className="flex items-center gap-2 bg-white border border-amber-200 rounded-lg px-3 py-2">
                          <span className="text-base">🥇</span>
                          <span className="text-xs font-semibold text-amber-700 w-14 shrink-0">Pool {s.pool}</span>
                          <span className="font-medium text-slate-900 text-sm truncate">{s.first.playerName}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {round.ctpWinners.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {round.ctpWinners.map((c) => (
                  <Badge key={c.id} className="bg-orange-100 text-orange-800 border border-orange-200 hover:bg-orange-100">
                    🎯 Hole {c.hole}: {c.playerName}
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <Link
            href={`/rounds/${round.id}?league=${leagueId}`}
            className="shrink-0 text-sm font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-300 hover:border-amber-400 px-3 py-1 rounded-full transition-colors"
          >
            Scorecard →
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
