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
  shortName: string | null;
  year: number;
  location: string;
  startDate: string;
  endDate: string;
  qualifyingWeeks: number;
  bestScoresCount: number;
  minWeeks: number;
  acePotPrice: number;
  priceWithTag: number;
  priceWithoutTag: number;
  facebookUrl: string | null;
  facebookLabel: string | null;
}

function toDateInput(iso: string) {
  return iso.slice(0, 10);
}

function LeagueForm({
  initial,
  onSave,
  onClose,
  onDeleted,
}: {
  initial?: League;
  onSave: () => void;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [shortName, setShortName] = useState(initial?.shortName ?? "");
  const [year, setYear] = useState(initial?.year ?? new Date().getFullYear());
  const [location, setLocation] = useState(initial?.location ?? "");
  const [startDate, setStartDate] = useState(initial ? toDateInput(initial.startDate) : "");
  const [endDate, setEndDate] = useState(initial ? toDateInput(initial.endDate) : "");
  const [qualifyingWeeks, setQualifyingWeeks] = useState(initial?.qualifyingWeeks ?? 9);
  const [bestScoresCount, setBestScoresCount] = useState(initial?.bestScoresCount ?? 5);
  const [minWeeks, setMinWeeks] = useState(initial?.minWeeks ?? 5);
  const [acePotPrice, setAcePotPrice] = useState(initial?.acePotPrice ?? 0);
  const [priceWithTag, setPriceWithTag] = useState(initial?.priceWithTag ?? 0);
  const [priceWithoutTag, setPriceWithoutTag] = useState(initial?.priceWithoutTag ?? 0);
  const [facebookUrl, setFacebookUrl] = useState(initial?.facebookUrl ?? "");
  const [facebookLabel, setFacebookLabel] = useState(initial?.facebookLabel ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

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
        body: JSON.stringify({ name, shortName, year, location, startDate, endDate, qualifyingWeeks, bestScoresCount, minWeeks, acePotPrice, priceWithTag, priceWithoutTag, facebookUrl, facebookLabel }),
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

  async function handleDelete() {
    if (!initial) return;
    setDeleting(true);
    setDeleteError("");
    const res = await fetch(`/api/leagues/${initial.id}`, { method: "DELETE" });
    if (!res.ok) {
      const body = await res.json();
      setDeleteError(body.error ?? "Delete failed");
      setDeleting(false);
      return;
    }
    onDeleted();
  }

  const isValid = name.trim() && location.trim() && startDate && endDate;

  if (confirmingDelete) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-[var(--ink)]">
          Delete <strong>{initial?.name}</strong>? This cannot be undone — all rounds, results, and
          standings for this league will be permanently removed.
        </p>
        {deleteError && <p className="text-sm text-red-600">{deleteError}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setConfirmingDelete(false)} disabled={deleting}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
            {deleting ? "Deleting..." : "Delete League"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
        <Label>Short Name <span className="text-[var(--ink-muted)] font-normal">(optional)</span></Label>
        <Input value={shortName} onChange={(e) => setShortName(e.target.value)} placeholder="e.g. ADG Summer League" />
        <p className="text-xs text-[var(--ink-muted)]">Displayed below the full name in the public hero banner.</p>
      </div>

      <div className="space-y-2">
        <Label>Location</Label>
        <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Dieppe, NB" />
      </div>

      <div className="space-y-3">
        <div className="space-y-2">
          <Label>Facebook Post URL <span className="text-[var(--ink-muted)] font-normal">(optional)</span></Label>
          <Input
            value={facebookUrl}
            onChange={(e) => setFacebookUrl(e.target.value)}
            placeholder="https://www.facebook.com/share/p/..."
            type="url"
          />
        </div>
        <div className="space-y-2">
          <Label>Button Label <span className="text-[var(--ink-muted)] font-normal">(optional)</span></Label>
          <Input
            value={facebookLabel}
            onChange={(e) => setFacebookLabel(e.target.value)}
            placeholder="More Info"
            disabled={!facebookUrl}
          />
        </div>
        <p className="text-xs text-[var(--ink-muted)]">Shown as a button in the hero banner on the public homepage.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Start Date</Label>
          <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>End Date</Label>
          <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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

      <div className="space-y-2">
        <Label>Round Pricing</Label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label className="text-xs text-[var(--ink-muted)] font-normal">Ace Pot</Label>
            <Input type="number" min={0} step="0.01" value={acePotPrice} onChange={(e) => setAcePotPrice(Number(e.target.value))} />
          </div>
          <div className="space-y-2">
            <Label className="text-xs text-[var(--ink-muted)] font-normal">With Tag</Label>
            <Input type="number" min={0} step="0.01" value={priceWithTag} onChange={(e) => setPriceWithTag(Number(e.target.value))} />
          </div>
          <div className="space-y-2">
            <Label className="text-xs text-[var(--ink-muted)] font-normal">Without Tag</Label>
            <Input type="number" min={0} step="0.01" value={priceWithoutTag} onChange={(e) => setPriceWithoutTag(Number(e.target.value))} />
          </div>
        </div>
        <p className="text-xs text-[var(--ink-muted)]">Per-round check-in prices, used to prefill payment amounts.</p>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex items-center justify-between gap-2">
        {initial ? (
          <Button
            variant="outline"
            className="text-red-600 hover:text-red-700"
            onClick={() => setConfirmingDelete(true)}
          >
            Delete League
          </Button>
        ) : (
          <div />
        )}
        <div className="flex gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || !isValid}>
            {saving ? "Saving..." : "Save League"}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function AdminPage() {
  const [leagues, setLeagues] = useState<League[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<League | undefined>();

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/leagues", { cache: "no-store" });
      const data = await res.json();
      setLeagues(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function handleDeleted() {
    setOpen(false);
    setEditing(undefined);
    load();
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--ink)]">Leagues</h1>
          <p className="text-[var(--ink-muted)] mt-1">Create and manage league seasons.</p>
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
              onDeleted={handleDeleted}
            />
          </DialogContent>
        </Dialog>
      </div>

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
                    <Skeleton className="h-8 w-16 rounded-md" />
                    <Skeleton className="h-8 w-14 rounded-md" />
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
          <CardContent className="py-8 text-center text-[var(--ink-muted)]">
            No leagues yet. Add one to get started.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {leagues.map((league) => (
            <Card key={league.id}>
              <CardHeader className="pb-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-base">{league.name}</CardTitle>
                      <Badge variant="secondary">{league.year}</Badge>
                    </div>
                    <p className="text-sm text-[var(--ink-muted)] mt-0.5">{league.location}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button asChild size="sm">
                      <Link href={`/admin/leagues/${league.id}`}>Rounds</Link>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => { setEditing(league); setOpen(true); }}
                    >
                      Edit
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm text-[var(--ink-2)]">
                  <div>
                    <span className="text-[var(--ink-muted)] text-xs">Dates</span>
                    <p>{toDateInput(league.startDate)} → {toDateInput(league.endDate)}</p>
                  </div>
                  <div>
                    <span className="text-[var(--ink-muted)] text-xs">Qualifying weeks</span>
                    <p>{league.qualifyingWeeks}</p>
                  </div>
                  <div>
                    <span className="text-[var(--ink-muted)] text-xs">Best {league.bestScoresCount} of {league.qualifyingWeeks}, min {league.minWeeks}</span>
                    <p className="text-xs text-[var(--ink-muted)]">Standings rules</p>
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
