import { prisma } from "@/lib/db";
import { getStandings } from "@/lib/standings";
import { notFound } from "next/navigation";
import { ScorecardTable } from "@/components/scorecard-table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Division } from "@/generated/prisma/client";
import { formatDate, formatScore } from "@/lib/utils";
import Link from "next/link";

export const revalidate = 60;

type PoolWinner = {
  pool: string;
  playerName: string;
  score: number;
  relativeScore: number;
};

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

export default async function RoundPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const round = await prisma.round.findUnique({
    where: { id: Number(id) },
    include: {
      results: {
        include: { player: true },
        orderBy: [{ division: "asc" }, { position: "asc" }],
      },
      ctpWinners: { orderBy: { hole: "asc" } },
      poolWinners: { orderBy: { pool: "asc" } },
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
  const poolWinners: PoolWinner[] = [];

  if (round.isChampionship) {
    const standings = await getStandings(round.leagueId);
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
      A: "🔵 Pool A",
      B: "🔵 Pool B",
      C: "🔴 Pool C",
      D: "🔴 Pool D",
    };

    poolGroups = (["A", "B", "C", "D"] as const)
      .filter((p) => groups[p].length > 0)
      .map((p) => ({ pool: p, label: poolLabels[p], rows: assignPositions(groups[p]) }));

    blueUnqualified = assignPositions(blueUnqualified);
    redUnqualified = assignPositions(redUnqualified);

    // Pool winners: prefer saved overrides, fall back to position 1 in each pool
    const savedOverrides = new Map<string, string>();
    for (const pw of round.poolWinners) savedOverrides.set(pw.pool, pw.playerName);

    for (const g of poolGroups) {
      const overrideName = savedOverrides.get(g.pool);
      const winner = overrideName
        ? (g.rows.find((r) => r.playerName === overrideName) ?? g.rows.find((r) => r.position === 1))
        : g.rows.find((r) => r.position === 1);
      if (winner) poolWinners.push({ pool: g.pool, playerName: winner.playerName, score: winner.score, relativeScore: winner.relativeScore });
    }
  }

  const bluePools = poolWinners.filter((w) => ["A", "B"].includes(w.pool));
  const redPools = poolWinners.filter((w) => ["C", "D"].includes(w.pool));

  return (
    <div className="space-y-6">
      <div>
        <Link href="/rounds" className="text-sm text-slate-500 hover:text-slate-700 mb-2 inline-block">
          ← All Rounds
        </Link>
        <h1 className="text-3xl font-bold text-slate-900">
          {round.isChampionship ? "Championship" : `Week ${round.weekNumber}`}
        </h1>
        <p className="text-slate-500 mt-1">
          {formatDate(round.date)} · {round.league.name}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="text-2xl font-bold tabular-nums">{round.results.length}</div>
            <div className="text-xs text-slate-500">Total Players</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="text-2xl font-bold tabular-nums">{blueResults.length}</div>
            <div className="text-xs text-slate-500">Blue Division</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="text-2xl font-bold tabular-nums">{redResults.length}</div>
            <div className="text-xs text-slate-500">Red Division</div>
          </CardContent>
        </Card>
      </div>

      {round.isChampionship && poolWinners.length > 0 && (
        <Card className="border-amber-300 bg-gradient-to-br from-amber-50 to-white">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <span className="text-2xl">🏆</span>
              <CardTitle className="text-xl">Pool Champions</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-6">
              <PoolWinnersColumn label="🔵 Blue Division" pools={bluePools} />
              <PoolWinnersColumn label="🔴 Red Division" pools={redPools} />
            </div>
          </CardContent>
        </Card>
      )}

      {round.ctpWinners.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">🎯 CTP Winners</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {round.ctpWinners.map((c) => (
                <Badge key={c.id} variant="secondary" className="text-sm">
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

function PoolWinnersColumn({ label, pools }: { label: string; pools: PoolWinner[] }) {
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
