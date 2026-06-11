"use client";

import { useState, useEffect, use } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface CtpWinner {
  hole: number;
  playerName: string;
}

interface Round {
  id: number;
  weekNumber: number;
  date: string;
  notes: string | null;
  results: { id: number; position: number; division: string; player: { name: string }; score: number; relativeScore: number }[];
  ctpWinners: CtpWinner[];
}

export default function AdminRoundPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [round, setRound] = useState<Round | null>(null);
  const [ctpWinners, setCtpWinners] = useState<CtpWinner[]>([{ hole: 18, playerName: "" }]);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function load() {
    const res = await fetch(`/api/rounds/${id}`);
    const data = await res.json();
    setRound(data);
    if (data.ctpWinners?.length > 0) {
      setCtpWinners(data.ctpWinners.map((c: any) => ({ hole: c.hole, playerName: c.playerName })));
    }
  }

  useEffect(() => { load(); }, [id]);

  async function handleSaveCtp() {
    setSaving(true);
    const valid = ctpWinners.filter((c) => c.playerName.trim());
    await fetch(`/api/rounds/${id}/ctp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ctpWinners: valid }),
    });
    await load();
    setSaving(false);
  }

  async function handleDelete() {
    if (!confirm("Delete this round and all its results?")) return;
    setDeleting(true);
    await fetch(`/api/rounds/${id}`, { method: "DELETE" });
    router.push("/admin");
  }

  if (!round) return <div className="text-slate-500">Loading...</div>;

  const blueResults = round.results.filter((r) => r.division === "BLUE");
  const redResults = round.results.filter((r) => r.division === "RED");

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/admin" className="text-sm text-slate-500 hover:text-slate-700">← Admin</Link>
          <h1 className="text-2xl font-bold text-slate-900 mt-1">
            Week {round.weekNumber} — Manage Round
          </h1>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={`/rounds/${id}`}>View Public Page</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href={`/admin/rounds/${id}/image`}>📰 Image</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href={`/admin/rounds/${id}/post`}>📣 Post</Link>
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Results Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-6">
            {[{ div: "BLUE", label: "🔵 Blue Division", results: blueResults },
              { div: "RED", label: "🔴 Red Division", results: redResults }].map(({ label, results }) => (
              <div key={label}>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">{label}</p>
                <ol className="space-y-1">
                  {results.slice(0, 5).map((r) => (
                    <li key={r.id} className="text-sm flex items-center gap-2">
                      <span className="text-slate-400 w-4">{r.position}.</span>
                      <span className="text-slate-900">{r.player.name}</span>
                      <span className="ml-auto font-mono text-xs text-slate-500">{r.score}</span>
                    </li>
                  ))}
                  {results.length > 5 && (
                    <li className="text-xs text-slate-400">+{results.length - 5} more</li>
                  )}
                </ol>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">🎯 CTP Winners</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {ctpWinners.map((ctp, i) => (
              <div key={i} className="grid grid-cols-[80px_1fr_auto] gap-2 items-end">
                <div>
                  <Label className="text-xs">Hole</Label>
                  <Input
                    type="number"
                    min={1}
                    max={18}
                    value={ctp.hole}
                    onChange={(e) => {
                      const next = [...ctpWinners];
                      next[i] = { ...ctp, hole: Number(e.target.value) };
                      setCtpWinners(next);
                    }}
                  />
                </div>
                <div>
                  <Label className="text-xs">Player Name</Label>
                  <Input
                    value={ctp.playerName}
                    onChange={(e) => {
                      const next = [...ctpWinners];
                      next[i] = { ...ctp, playerName: e.target.value };
                      setCtpWinners(next);
                    }}
                    placeholder="Player name"
                  />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCtpWinners(ctpWinners.filter((_, j) => j !== i))}
                  className="text-red-500 hover:text-red-700"
                >
                  Remove
                </Button>
              </div>
            ))}
            <div className="flex gap-2 pt-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCtpWinners([...ctpWinners, { hole: 18, playerName: "" }])}
              >
                + Add CTP
              </Button>
              <Button size="sm" onClick={handleSaveCtp} disabled={saving}>
                {saving ? "Saving..." : "Save CTP Winners"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="pt-4 border-t border-slate-200">
        <Button
          variant="destructive"
          onClick={handleDelete}
          disabled={deleting}
          size="sm"
        >
          {deleting ? "Deleting..." : "Delete Round"}
        </Button>
        <p className="text-xs text-slate-400 mt-1">This will permanently delete all results for this round.</p>
      </div>
    </div>
  );
}
