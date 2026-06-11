import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import { ScorecardTable } from "@/components/scorecard-table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Division } from "@/generated/prisma/client";
import { formatDate } from "@/lib/utils";
import Link from "next/link";

export const revalidate = 60;

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
      blueLayout: { include: { holePars: { orderBy: { holeNumber: "asc" } } } },
      redLayout: { include: { holePars: { orderBy: { holeNumber: "asc" } } } },
      league: true,
    },
  });

  if (!round) notFound();

  const blueResults = round.results.filter((r) => r.division === Division.BLUE);
  const redResults = round.results.filter((r) => r.division === Division.RED);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/rounds" className="text-sm text-slate-500 hover:text-slate-700 mb-2 inline-block">
          ← All Rounds
        </Link>
        <h1 className="text-3xl font-bold text-slate-900">Week {round.weekNumber}</h1>
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
    </div>
  );
}
