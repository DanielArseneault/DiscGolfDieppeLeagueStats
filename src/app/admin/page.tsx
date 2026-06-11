import { prisma } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import Link from "next/link";

export default async function AdminDashboard() {
  const [league, rounds] = await Promise.all([
    prisma.league.findFirst({ orderBy: { year: "desc" } }),
    prisma.round.findMany({
      orderBy: { weekNumber: "desc" },
      include: {
        _count: { select: { results: true } },
        post: { select: { id: true } },
        newspaperImage: { select: { id: true, generatedAt: true } },
        ctpWinners: true,
      },
      take: 20,
    }),
  ]);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Admin Dashboard</h1>
          {league && <p className="text-slate-500 text-sm mt-1">{league.name}</p>}
        </div>
        <div className="flex gap-3">
          <Button asChild variant="outline">
            <Link href="/admin/layouts">Manage Layouts</Link>
          </Button>
          <Button asChild>
            <Link href="/admin/import">Import Round</Link>
          </Button>
        </div>
      </div>

      {!league && (
        <Card className="border-dashed border-2">
          <CardContent className="py-8 text-center">
            <p className="text-slate-500 mb-4">No league set up yet. Create one to get started.</p>
            <Button asChild>
              <Link href="/admin/league/new">Create League</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {rounds.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Rounds</h2>
          <div className="space-y-3">
            {rounds.map((round) => (
              <Card key={round.id}>
                <CardContent className="py-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-3">
                        <span className="font-semibold text-slate-900">Week {round.weekNumber}</span>
                        <span className="text-sm text-slate-500">{formatDate(round.date)}</span>
                        <Badge variant="secondary">{round._count.results} players</Badge>
                      </div>
                      <div className="flex gap-2 mt-1.5">
                        {round.ctpWinners.length > 0 && (
                          <span className="text-xs text-slate-400">🎯 {round.ctpWinners.length} CTP</span>
                        )}
                        {round.post && (
                          <span className="text-xs text-emerald-600">✓ Post saved</span>
                        )}
                        {round.newspaperImage?.generatedAt && (
                          <span className="text-xs text-emerald-600">✓ Image generated</span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/rounds/${round.id}`}>View</Link>
                      </Button>
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/admin/rounds/${round.id}`}>Manage</Link>
                      </Button>
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/admin/rounds/${round.id}/image`}>Image</Link>
                      </Button>
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/admin/rounds/${round.id}/post`}>Post</Link>
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
