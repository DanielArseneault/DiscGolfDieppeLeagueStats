"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useRouter } from "next/navigation";

interface Layout {
  id: number;
  name: string;
}

interface PreviewResult {
  name: string;
  score: number;
  relativeScore: number;
  position: number;
}

interface ImportPreview {
  roundId: number;
  weekNumber: number;
  blueCount: number;
  redCount: number;
  inferredBluePar: number;
  inferredRedPar: number;
}

export default function ImportPage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [weekNumber, setWeekNumber] = useState("");
  const [date, setDate] = useState("");
  const [blueLayoutId, setBlueLayoutId] = useState("");
  const [redLayoutId, setRedLayoutId] = useState("");
  const [layouts, setLayouts] = useState<Layout[]>([]);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function loadLayouts() {
    const res = await fetch("/api/layouts");
    const data = await res.json();
    setLayouts(data);
  }

  useEffect(() => {
    loadLayouts();
  }, []);

  async function handleImport(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !weekNumber || !date) return;

    setLoading(true);
    setError("");

    const formData = new FormData();
    formData.append("file", file);
    formData.append("leagueId", "1");
    formData.append("weekNumber", weekNumber);
    formData.append("date", date);
    if (blueLayoutId) formData.append("blueLayoutId", blueLayoutId);
    if (redLayoutId) formData.append("redLayoutId", redLayoutId);

    try {
      const res = await fetch("/api/import", { method: "POST", body: formData });
      if (!res.ok) {
        const err = await res.json();
        setError(err.error ?? "Import failed");
        return;
      }
      const data = await res.json();
      setPreview(data);
    } catch {
      setError("Failed to import. Check the file format.");
    } finally {
      setLoading(false);
    }
  }

  if (preview) {
    return (
      <div className="space-y-6 max-w-2xl">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Import Complete</h1>
          <p className="text-slate-500 mt-1">Week {preview.weekNumber} data has been imported.</p>
        </div>
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-slate-500">Blue Division</p>
                <p className="text-2xl font-bold">{preview.blueCount} players</p>
                <p className="text-xs text-slate-400 mt-1">Inferred par: {preview.inferredBluePar}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Red Division</p>
                <p className="text-2xl font-bold">{preview.redCount} players</p>
                <p className="text-xs text-slate-400 mt-1">Inferred par: {preview.inferredRedPar}</p>
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <Button onClick={() => router.push(`/admin/rounds/${preview.roundId}`)}>
                Manage Round
              </Button>
              <Button variant="outline" onClick={() => setPreview(null)}>
                Import Another
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Import Round</h1>
        <p className="text-slate-500 mt-1">
          Upload a UDisc export file (.xlsx or .csv) to import league night results.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">UDisc Export File</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleImport} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="file">File (.xlsx or .csv)</Label>
              <Input
                ref={fileRef}
                id="file"
                type="file"
                accept=".xlsx,.csv,.xls"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                required
              />
              <p className="text-xs text-slate-400">
                Export from UDisc: Scoring › League › Export scores
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="week">Week Number</Label>
                <Input
                  id="week"
                  type="number"
                  min={1}
                  max={10}
                  value={weekNumber}
                  onChange={(e) => setWeekNumber(e.target.value)}
                  placeholder="e.g. 5"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="date">Date</Label>
                <Input
                  id="date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Blue Layout (optional)</Label>
                <Select value={blueLayoutId} onValueChange={setBlueLayoutId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select layout..." />
                  </SelectTrigger>
                  <SelectContent>
                    {layouts.map((l) => (
                      <SelectItem key={l.id} value={String(l.id)}>{l.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Red Layout (optional)</Label>
                <Select value={redLayoutId} onValueChange={setRedLayoutId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select layout..." />
                  </SelectTrigger>
                  <SelectContent>
                    {layouts.map((l) => (
                      <SelectItem key={l.id} value={String(l.id)}>{l.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {layouts.length === 0 && (
              <p className="text-xs text-amber-600 bg-amber-50 rounded p-2">
                No layouts configured yet. You can{" "}
                <a href="/admin/layouts" className="underline">add layouts</a>{" "}
                to track per-hole par values, or import without a layout.
              </p>
            )}

            {error && <p className="text-sm text-red-600">{error}</p>}

            <Button type="submit" className="w-full" disabled={loading || !file}>
              {loading ? "Importing..." : "Import Round"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
