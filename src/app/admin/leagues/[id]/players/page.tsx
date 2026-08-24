import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PlayerGenderEditor } from "@/components/admin/player-gender-editor";

export default async function LeaguePlayersPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const leagueId = Number(id);

  const [league, players] = await Promise.all([
    prisma.league.findUnique({ where: { id: leagueId } }),
    prisma.player.findMany({
      where: { leagueId },
      include: {
        results: { select: { division: true }, distinct: ["division"] },
        checkIns: { select: { division: true }, distinct: ["division"] },
      },
      orderBy: { name: "asc" },
    }),
  ]);

  if (!league) notFound();

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/admin/leagues/${id}`} className="text-sm text-[var(--ink-muted)] hover:text-[var(--ink)]">
          ← {league.name}
        </Link>
        <h1 className="text-2xl font-bold text-[var(--ink)] mt-1">Players</h1>
        <p className="text-sm text-[var(--ink-muted)] mt-0.5">
          Set each player&apos;s gender so the tag ladder can keep a separate tag pool for female
          players in each division.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Player Roster</CardTitle>
        </CardHeader>
        <CardContent>
          <PlayerGenderEditor
            players={players.map((p) => ({
              id: p.id,
              name: p.name,
              divisions: Array.from(new Set([...p.results.map((r) => r.division), ...p.checkIns.map((c) => c.division)])),
              gender: p.gender,
            }))}
          />
        </CardContent>
      </Card>
    </div>
  );
}
