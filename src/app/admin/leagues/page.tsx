"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import Link from "next/link";

interface League {
  id: number;
  name: string;
  year: number;
  location: string;
  startDate: string;
  endDate: string;
  qualifyingWeeks: number;
  bestScoresCount: number;
  minWeeks: number;
}

function toDateInput(iso: string) {
  return iso.slice(0, 10);
}

function LeagueForm({
  initial,
  onSave,
  onClose,
}: {
  initial?: League;
  onSave: () => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [year, setYear] = useState(initial?.year ?? new Date().getFullYear());
  const [location, setLocation] = useState(initial?.location ?? "");
  const [startDate, setStartDate] = useState(initial ? toDateInput(initial.startDate) : "");
  const [endDate, setEndDate] = useState(initial ? toDateInput(initial.endDate) : "");
  const [qualifyingWeeks, setQualifyingWeeks] = useState(initial?.qualifyingWeeks ?? 9);
  const [bestScoresCount, setBestScoresCount] = useState(initial?.bestScoresCount ?? 5);
  const [minWeeks, setMinWeeks] = useState(initial?.minWeeks ?? 5);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSave() {
    if (!name.trim() || !location.trim() || !startDate || !endDate) return;
    setSaving(true);
    setError("");
    try {
      const url = initial ? `/api/leagues/${initial.id}` : "/api/leagues";
      const method = initial ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, year, location, startDate, endDate, qualifyingWeeks, bestScoresCount, minWeeks }),
      });
      if (!res.ok) throw new Error("Save failed");
      onSave();
      onClose();
    } catch {
      setError("Failed to save league");
    } finally {
      setSaving(false);
    }
  }

  const isValid = name.trim() && location.trim() && startDate && endDate;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>League Name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Dieppe Disc Golf League" />
        </div>
        <div className="space-y-2">
          <Label>Year</Label>
          <Input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Location</Label>
        <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Dieppe, NB" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Start Date</Label>
          <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>End Date</Label>
          <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label>Qualifying Weeks</Label>
          <Input type="number" min={1} value={qualifyingWeeks} onChange={(e) => setQualifyingWeeks(Number(e.target.value))} />
        </div>
        <div className="space-y-2">
          <Label>Best Scores Count</Label>
          <Input type="number" min={1} value={bestScoresCount} onChange={(e) => setBestScoresCount(Number(e.target.value))} />
        </div>
        <div className="space-y-2">
          <Label>Min Weeks</Label>
          <Input type="number" min={1} value={minWeeks} onChange={(e) => setMinWeeks(Number(e.target.value))} />
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={handleSave} disabled={saving || !isValid}>
          {saving ? "Saving..." : "Save League"}
        </Button>
      </div>
    </div>
  );
}

export default function LeaguesPage() {
  const [leagues, setLeagues] = useState<League[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<League | undefined>();
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/leagues");
      const data = await res.json();
      setLeagues(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleDelete(id: number) {
    if (!confirm("Delete this league? This cannot be undone.")) return;
    setDeleteError(null);
    const res = await fetch(`/api/leagues/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const body = await res.json();
      setDeleteError(body.error ?? "Delete failed");
      return;
    }
    load();
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Leagues</h1>
          <p className="text-slate-500 mt-1">Create and manage league seasons.</p>
        </div>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditing(undefined); }}>
          <DialogTrigger asChild>
            <Button onClick={() => setEditing(undefined)}>+ Add League</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editing ? "Edit League" : "Add League"}</DialogTitle>
            </DialogHeader>
            <LeagueForm
              initial={editing}
              onSave={load}
              onClose={() => setOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </div>

      {deleteError && (
        <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {deleteError}
        </div>
      )}

      {loading ? (
        <div className="space-y-4">
          {[0, 1, 2].map((i) => (
            <Card key={i}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-2">
                    <Skeleton className="h-5 w-48" />
                    <Skeleton className="h-4 w-28" />
                  </div>
                  <div className="flex gap-2">
                    <Skeleton className="h-8 w-24 rounded-md" />
                    <Skeleton className="h-8 w-14 rounded-md" />
                    <Skeleton className="h-8 w-16 rounded-md" />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : leagues.length === 0 ? (
        <Card className="border-dashed border-2">
          <CardContent className="py-8 text-center text-slate-500">
            No leagues yet. Add one to get started.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {leagues.map((league) => (
            <Card key={league.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-base">{league.name}</CardTitle>
                      <Badge variant="secondary">{league.year}</Badge>
                    </div>
                    <p className="text-sm text-slate-500 mt-0.5">{league.location}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/admin/leagues/${league.id}`}>View Rounds</Link>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => { setEditing(league); setOpen(true); }}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(league.id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4 text-sm text-slate-600">
                  <div>
                    <span className="text-slate-400 text-xs">Dates</span>
                    <p>{toDateInput(league.startDate)} → {toDateInput(league.endDate)}</p>
                  </div>
                  <div>
                    <span className="text-slate-400 text-xs">Qualifying weeks</span>
                    <p>{league.qualifyingWeeks}</p>
                  </div>
                  <div>
                    <span className="text-slate-400 text-xs">Best {league.bestScoresCount} of {league.qualifyingWeeks}, min {league.minWeeks}</span>
                    <p className="text-xs text-slate-500">Standings rules</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
