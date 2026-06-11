import { prisma } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import Link from "next/link";

export const revalidate = 60;

export default async function RoundsPage() {
  const league = await prisma.league.findFirst({ orderBy: { year: "desc" } });
  if (!league) return <p className="text-slate-500">No league found.</p>;

  const rounds = await prisma.round.findMany({
    where: { leagueId: league.id },
    orderBy: { weekNumber: "desc" },
    include: {
      _count: { select: { results: true } },
      ctpWinners: true,
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">All Rounds</h1>
        <p className="text-slate-500 mt-1">{league.name}</p>
      </div>

      {rounds.length === 0 ? (
        <p className="text-slate-500">No rounds recorded yet.</p>
      ) : (
        <div className="space-y-3">
          {rounds.map((round) => (
            <Link key={round.id} href={`/rounds/${round.id}`}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="py-4 flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-slate-900">{round.isChampionship ? "Championship" : `Week ${round.weekNumber}`}</div>
                    <div className="text-sm text-slate-500 mt-0.5">{formatDate(round.date)}</div>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-slate-500">
                    <span>{round._count.results} players</span>
                    {round.ctpWinners.length > 0 && (
                      <Badge variant="secondary">🎯 {round.ctpWinners.length} CTP</Badge>
                    )}
                    <span className="text-slate-300">→</span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
