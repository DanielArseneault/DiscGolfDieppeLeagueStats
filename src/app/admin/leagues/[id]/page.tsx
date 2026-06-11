import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { getStandings } from "@/lib/standings";
import { PoolExclusions } from "@/components/admin/pool-exclusions";

export default async function LeagueDashboard({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [league, rounds, standings] = await Promise.all([
    prisma.league.findUnique({ where: { id: Number(id) } }),
    prisma.round.findMany({
      where: { leagueId: Number(id) },
      orderBy: { weekNumber: "desc" },
      include: {
        _count: { select: { results: true } },
        post: { select: { id: true } },
        newspaperImage: { select: { id: true, generatedAt: true } },
        ctpWinners: { select: { id: true } },
      },
    }),
    getStandings(Number(id)),
  ]);

  if (!league) notFound();

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/admin/leagues" className="text-sm text-slate-500 hover:text-slate-700">
            ← All Leagues
          </Link>
          <h1 className="text-2xl font-bold text-slate-900 mt-1">{league.name}</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {league.year} · {league.location} · {formatDate(league.startDate)} – {formatDate(league.endDate)}
          </p>
        </div>
        <Button asChild>
          <Link href={`/admin/leagues/${id}/import`}>Import Round</Link>
        </Button>
      </div>

      {rounds.length === 0 ? (
        <Card className="border-dashed border-2">
          <CardContent className="py-12 text-center text-slate-500">
            No rounds yet. Import the first round to get started.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {rounds.map((round) => {
            const ctpDone = round.ctpWinners.length > 0;
            const postDone = !!round.post;
            const imageDone = !!round.newspaperImage?.generatedAt;

            return (
              <Card key={round.id}>
                <CardContent className="py-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-3">
                        <span className="font-semibold text-slate-900">
                          {round.isChampionship ? "Championship" : `Week ${round.weekNumber}`}
                        </span>
                        <span className="text-sm text-slate-500">{formatDate(round.date)}</span>
                        {round.isChampionship && <Badge variant="outline" className="text-amber-600 border-amber-300">Championship</Badge>}
                        <Badge variant="secondary">{round._count.results} players</Badge>
                      </div>
                      <div className="flex gap-3 mt-1.5 text-xs">
                        <span className={ctpDone ? "text-emerald-600 font-medium" : "text-slate-300"}>
                          ● CTP
                        </span>
                        <span className={postDone ? "text-emerald-600 font-medium" : "text-slate-300"}>
                          ● Post
                        </span>
                        <span className={imageDone ? "text-emerald-600 font-medium" : "text-slate-300"}>
                          ● Image
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/rounds/${round.id}`}>View</Link>
                      </Button>
                      <Button asChild size="sm">
                        <Link href={`/admin/leagues/${id}/rounds/${round.id}`}>Manage</Link>
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {standings.some((s) => s.qualified) && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Championship Pool Assignment</CardTitle>
            <p className="text-xs text-slate-500">Qualified players and their assigned pools. Exclude players who won&apos;t participate in the championship.</p>
          </CardHeader>
          <CardContent>
            <PoolExclusions
              players={standings
                .filter((s) => s.qualified)
                .map((s) => ({
                  playerId: s.playerId,
                  playerName: s.playerName,
                  division: s.division,
                  qualifyingTotal: s.qualifyingTotal,
                  championshipPool: s.championshipPool,
                  excludeFromChampionship: s.excludeFromChampionship,
                  championshipPoolOverride: s.championshipPoolOverride,
                }))}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
