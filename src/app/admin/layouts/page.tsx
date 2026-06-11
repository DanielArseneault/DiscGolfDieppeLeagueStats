"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";

interface HolePar {
  holeNumber: number;
  par: number;
}

interface Layout {
  id: number;
  name: string;
  description: string | null;
  holePars: HolePar[];
}

function defaultHolePars(): HolePar[] {
  return Array.from({ length: 18 }, (_, i) => ({ holeNumber: i + 1, par: 3 }));
}

function LayoutForm({
  initial,
  onSave,
  onClose,
}: {
  initial?: Layout;
  onSave: () => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [holePars, setHolePars] = useState<HolePar[]>(
    initial?.holePars ?? defaultHolePars()
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const totalPar = holePars.reduce((s, h) => s + h.par, 0);

  async function handleSave() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const url = initial ? `/api/layouts/${initial.id}` : "/api/layouts";
      const method = initial ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description, holePars }),
      });
      if (!res.ok) throw new Error("Save failed");
      onSave();
      onClose();
    } catch {
      setError("Failed to save layout");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Layout Name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Blue Layout" />
        </div>
        <div className="space-y-2">
          <Label>Description (optional)</Label>
          <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. Blue tees" />
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <Label>Par per Hole</Label>
          <span className="text-sm text-slate-500">Total par: <strong>{totalPar}</strong></span>
        </div>
        <div className="grid grid-cols-9 gap-1.5">
          {holePars.map((hp, i) => (
            <div key={hp.holeNumber} className="text-center">
              <div className="text-xs text-slate-400 mb-1">H{hp.holeNumber}</div>
              <Input
                type="number"
                min={2}
                max={6}
                value={hp.par}
                onChange={(e) => {
                  const next = [...holePars];
                  next[i] = { ...hp, par: Number(e.target.value) };
                  setHolePars(next);
                }}
                className="text-center px-1 h-8 text-sm"
              />
            </div>
          ))}
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={handleSave} disabled={saving || !name.trim()}>
          {saving ? "Saving..." : "Save Layout"}
        </Button>
      </div>
    </div>
  );
}

export default function LayoutsPage() {
  const [layouts, setLayouts] = useState<Layout[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Layout | undefined>();

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/layouts");
      const data = await res.json();
      setLayouts(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleDelete(id: number) {
    if (!confirm("Delete this layout?")) return;
    await fetch(`/api/layouts/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Course Layouts</h1>
          <p className="text-slate-500 mt-1">Manage tee layouts and par values for each hole.</p>
        </div>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditing(undefined); }}>
          <DialogTrigger asChild>
            <Button onClick={() => setEditing(undefined)}>+ Add Layout</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editing ? "Edit Layout" : "Add Layout"}</DialogTitle>
            </DialogHeader>
            <LayoutForm
              initial={editing}
              onSave={load}
              onClose={() => setOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[0, 1].map((i) => (
            <Card key={i}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-2">
                    <Skeleton className="h-5 w-36" />
                    <Skeleton className="h-4 w-20" />
                  </div>
                  <div className="flex gap-2">
                    <Skeleton className="h-8 w-14 rounded-md" />
                    <Skeleton className="h-8 w-16 rounded-md" />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Skeleton className="h-4 w-24 mb-2" />
                <div className="grid grid-cols-9 gap-1">
                  {Array.from({ length: 18 }).map((_, j) => (
                    <Skeleton key={j} className="h-10 w-full rounded" />
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : layouts.length === 0 ? (
        <Card className="border-dashed border-2">
          <CardContent className="py-8 text-center text-slate-500">
            No layouts yet. Add a Blue and Red layout to track per-hole par values.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {layouts.map((layout) => {
            const totalPar = layout.holePars.reduce((s, h) => s + h.par, 0);
            return (
              <Card key={layout.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-base">{layout.name}</CardTitle>
                      {layout.description && (
                        <p className="text-sm text-slate-500 mt-0.5">{layout.description}</p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => { setEditing(layout); setOpen(true); }}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(layout.id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-slate-500 mb-2">Total par: <strong>{totalPar}</strong></p>
                  <div className="grid grid-cols-9 gap-1 text-center text-xs">
                    {layout.holePars.map((hp) => (
                      <div key={hp.holeNumber} className="bg-slate-50 rounded px-1 py-1.5">
                        <div className="text-slate-400">H{hp.holeNumber}</div>
                        <div className="font-semibold text-slate-700">{hp.par}</div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
