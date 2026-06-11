import { prisma } from "@/lib/db";
import { getStandings } from "@/lib/standings";
import { Card, CardContent } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";
import Link from "next/link";

export const revalidate = 60;

async function getData() {
  const leagues = await prisma.league.findMany({ orderBy: { year: "desc" } });

  const leagueSummaries = await Promise.all(
    leagues.map(async (league) => {
      const [standings, roundCount, championshipRound] = await Promise.all([
        getStandings(league.id),
        prisma.round.count({ where: { leagueId: league.id, isChampionship: false } }),
        prisma.round.findFirst({
          where: { leagueId: league.id, isChampionship: true },
          include: { poolWinners: { orderBy: { pool: "asc" } } },
        }),
      ]);
      return { league, standings, roundCount, championshipRound };
    })
  );

  return leagueSummaries;
}

export default async function LeaguesPage() {
  const leagues = await getData();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">All Seasons</h1>
        <p className="text-slate-500 mt-1">Browse past and current league seasons.</p>
      </div>

      {leagues.length === 0 ? (
        <p className="text-slate-500">No leagues yet.</p>
      ) : (
        <div className="space-y-4">
          {leagues.map(({ league, standings, roundCount, championshipRound }) => {
            const blueCount = standings.filter((s) => s.division === "BLUE").length;
            const redCount = standings.filter((s) => s.division === "RED").length;
            const qualifiedCount = standings.filter((s) => s.qualified).length;
            const poolWinners = championshipRound?.poolWinners ?? [];

            return (
              <Link key={league.id} href={`/leagues/${league.id}`}>
                <Card className="hover:shadow-md transition-shadow cursor-pointer">
                  <CardContent className="py-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-1">
                          <h2 className="text-lg font-bold text-slate-900">{league.name}</h2>
                          {championshipRound && (
                            <span className="text-xs bg-amber-100 text-amber-700 font-medium px-2 py-0.5 rounded-full">
                              🏆 Complete
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-slate-500">
                          {formatDate(league.startDate)} – {formatDate(league.endDate)} · {league.location}
                        </p>
                        <div className="flex items-center gap-4 mt-3 text-xs text-slate-500">
                          <span>🔵 {blueCount} Blue</span>
                          <span>🔴 {redCount} Red</span>
                          <span>{qualifiedCount} qualified</span>
                          <span>{roundCount} rounds</span>
                        </div>
                        {poolWinners.length > 0 && (
                          <div className="flex flex-wrap gap-2 mt-3">
                            {poolWinners.map((w) => (
                              <span key={w.pool} className="text-xs bg-amber-50 border border-amber-200 text-amber-800 px-2 py-0.5 rounded">
                                Pool {w.pool}: {w.playerName}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="text-2xl font-black text-slate-200 select-none">{league.year}</div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
