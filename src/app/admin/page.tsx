import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function AdminPage() {
  const leagues = await prisma.league.findMany({ orderBy: { year: "desc" } });

  if (leagues.length === 1) {
    redirect(`/admin/leagues/${leagues[0].id}`);
  }

  return (
    <div className="space-y-8 max-w-2xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Admin</h1>
        <Button asChild variant="outline">
          <Link href="/admin/leagues">Manage Leagues</Link>
        </Button>
      </div>

      {leagues.length === 0 ? (
        <Card className="border-dashed border-2">
          <CardContent className="py-12 text-center">
            <p className="text-slate-500 mb-4">No leagues yet. Create one to get started.</p>
            <Button asChild>
              <Link href="/admin/leagues">Create League</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-slate-500">Select a league to manage.</p>
          {leagues.map((league) => (
            <Link key={league.id} href={`/admin/leagues/${league.id}`}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="py-4 flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-slate-900">{league.name}</div>
                    <div className="text-sm text-slate-500">{league.location}</div>
                  </div>
                  <Badge variant="secondary">{league.year}</Badge>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
