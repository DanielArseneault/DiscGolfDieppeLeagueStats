import { prisma } from "@/lib/db";
import { getStandings } from "@/lib/standings";
import { computePoolSummaries, PoolSummary } from "@/lib/pool-utils";
import { notFound } from "next/navigation";
import { ScorecardTable } from "@/components/scorecard-table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Division } from "@/generated/prisma/client";
import { formatDate, formatScore } from "@/lib/utils";
import Link from "next/link";

export const revalidate = 60;

type ResultRow = {
  position: number;
  playerName: string;
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
      ctpWinners: { orderBy: { hole: "asc" } },
      poolWinners: { orderBy: [{ pool: "asc" }, { place: "asc" }] },
      blueLayout: { include: { holePars: { orderBy: { holeNumber: "asc" } } } },
      redLayout: { include: { holePars: { orderBy: { holeNumber: "asc" } } } },
      league: true,
    },
  });

  if (!round) notFound();

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
      <div>
        <div className="flex items-center gap-2 text-sm text-slate-400 mb-3">
          <Link href={backUrl} className="hover:text-slate-600 transition-colors">
            Rounds
          </Link>
          <span>/</span>
          <span className="text-slate-600">
            {round.isChampionship ? "Championship" : `Week ${round.weekNumber}`}
          </span>
        </div>
        <h1 className="text-3xl font-bold text-slate-900">
          {round.isChampionship ? "🏆 Championship" : `Week ${round.weekNumber}`}
        </h1>
        <p className="text-slate-500 mt-1">
          {formatDate(round.date)} · {round.league.name}
        </p>
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
              <PoolSummaryColumn label="🔵 Blue Division" pools={blueSummaries} />
              <PoolSummaryColumn label="🔴 Red Division" pools={redSummaries} />
            </div>
          </CardContent>
        </Card>
      )}

      {round.ctpWinners.length > 0 && (
        <Card className="border-green-200">
          <CardHeader>
            <CardTitle className="text-base text-slate-900">🎯 CTP Winners</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {round.ctpWinners.map((c) => (
                <Badge key={c.id} className="bg-orange-100 text-orange-800 border border-orange-200 hover:bg-orange-100 text-sm">
                  Hole {c.hole}: {c.playerName}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {round.isChampionship ? (
        <>
          {poolGroups.map((g) => (
            <ScorecardTable
              key={g.pool}
              divisionLabel={g.label}
              results={g.rows}
              holePars={["A", "B"].includes(g.pool) ? (round.blueLayout?.holePars ?? []) : (round.redLayout?.holePars ?? [])}
            />
          ))}
          {blueUnqualified.length > 0 && (
            <ScorecardTable
              divisionLabel="🔵 Blue — Did Not Qualify"
              results={blueUnqualified}
              holePars={round.blueLayout?.holePars ?? []}
            />
          )}
          {redUnqualified.length > 0 && (
            <ScorecardTable
              divisionLabel="🔴 Red — Did Not Qualify"
              results={redUnqualified}
              holePars={round.redLayout?.holePars ?? []}
            />
          )}
        </>
      ) : (
        <>
          {blueResults.length > 0 && (
            <ScorecardTable
              divisionLabel="🔵 Blue Division"
              results={blueResults.map((r) => ({
                position: r.position,
                playerName: r.player.name,
                score: r.score,
                relativeScore: r.relativeScore,
                holeScores: r.holeScores as Record<string, number>,
              }))}
              holePars={round.blueLayout?.holePars ?? []}
            />
          )}
          {redResults.length > 0 && (
            <ScorecardTable
              divisionLabel="🔴 Red Division"
              results={redResults.map((r) => ({
                position: r.position,
                playerName: r.player.name,
                score: r.score,
                relativeScore: r.relativeScore,
                holeScores: r.holeScores as Record<string, number>,
              }))}
              holePars={round.redLayout?.holePars ?? []}
            />
          )}
        </>
      )}
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
