"use client";

import { useState, useEffect, useRef, use } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useRouter } from "next/navigation";
import Link from "next/link";

function parseFilename(name: string): { date: string | null; weekNumber: string | null } {
  const base = name.replace(/\.(xlsx?|csv)$/i, "");
  const dateMatch = base.match(/(\d{4}-\d{2}-\d{2})/);
  const weekMatch = base.match(/(?:week\s*#?\s*)(\d+)/i);
  return {
    date: dateMatch ? dateMatch[1] : null,
    weekNumber: weekMatch ? weekMatch[1] : null,
  };
}

interface Layout {
  id: number;
  name: string;
}

interface ImportPreview {
  roundId: number;
  weekNumber: number;
  blueCount: number;
  redCount: number;
  inferredBluePar: number;
  inferredRedPar: number;
}

export default function ImportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: leagueId } = use(params);
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [weekNumber, setWeekNumber] = useState("");
  const [date, setDate] = useState("");
  const [isChampionship, setIsChampionship] = useState(false);
  const [blueLayoutId, setBlueLayoutId] = useState("");
  const [redLayoutId, setRedLayoutId] = useState("");
  const [layouts, setLayouts] = useState<Layout[]>([]);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/layouts")
      .then((r) => r.json())
      .then((data: Layout[]) => {
        setLayouts(data);
        const blue = data.find((l) => /blue/i.test(l.name));
        const red = data.find((l) => /red/i.test(l.name));
        if (blue) setBlueLayoutId(String(blue.id));
        else if (data[0]) setBlueLayoutId(String(data[0].id));
        if (red) setRedLayoutId(String(red.id));
        else if (data[1]) setRedLayoutId(String(data[1].id));
      });
  }, []);

  async function handleImport(e: React.FormEvent) {
    e.preventDefault();
    if (!file || (!isChampionship && !weekNumber) || !date) return;

    setLoading(true);
    setError("");

    const formData = new FormData();
    formData.append("file", file);
    formData.append("leagueId", leagueId);
    formData.append("weekNumber", isChampionship ? "99" : weekNumber);
    formData.append("date", date);
    formData.append("isChampionship", String(isChampionship));
    if (blueLayoutId) formData.append("blueLayoutId", blueLayoutId);
    if (redLayoutId) formData.append("redLayoutId", redLayoutId);

    try {
      const res = await fetch("/api/import", { method: "POST", body: formData });
      if (!res.ok) {
        const err = await res.json();
        setError(err.error ?? "Import failed");
        return;
      }
      setPreview(await res.json());
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
          <Link href={`/admin/leagues/${leagueId}`} className="text-sm text-slate-500 hover:text-slate-700">
            ← League Dashboard
          </Link>
          <h1 className="text-2xl font-bold text-slate-900 mt-1">Import Complete</h1>
          <p className="text-slate-500 mt-0.5">{isChampionship ? "Championship round" : `Week ${preview.weekNumber}`} data has been imported.</p>
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
              <Button onClick={() => router.push(`/admin/leagues/${leagueId}/rounds/${preview.roundId}`)}>
                Manage Round →
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
        <Link href={`/admin/leagues/${leagueId}`} className="text-sm text-slate-500 hover:text-slate-700">
          ← League Dashboard
        </Link>
        <h1 className="text-2xl font-bold text-slate-900 mt-1">Import Round</h1>
        <p className="text-slate-500 mt-0.5">
          Upload a UDisc export file (.xlsx) to import league night results.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">UDisc Export File</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleImport} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="file">File (.xlsx)</Label>
              <Input
                ref={fileRef}
                id="file"
                type="file"
                accept=".xlsx,.csv,.xls"
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null;
                  setFile(f);
                  if (f) {
                    const parsed = parseFilename(f.name);
                    if (parsed.date) setDate(parsed.date);
                    if (parsed.weekNumber) setWeekNumber(parsed.weekNumber);
                  }
                }}
                required
              />
              <p className="text-xs text-slate-400">
                Export from UDisc: Scoring › League › Export scores
              </p>
            </div>

            <label className="flex items-center gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isChampionship}
                onChange={(e) => setIsChampionship(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300"
              />
              <div>
                <span className="text-sm font-medium text-slate-900">Championship round</span>
                <p className="text-xs text-slate-500">Excluded from qualifying standings</p>
              </div>
            </label>

            <div className="grid grid-cols-2 gap-4">
              {!isChampionship && (
                <div className="space-y-2">
                  <Label htmlFor="week">Week Number</Label>
                  <Input
                    id="week"
                    type="number"
                    min={1}
                    max={52}
                    value={weekNumber}
                    onChange={(e) => setWeekNumber(e.target.value)}
                    placeholder="e.g. 5"
                    required
                  />
                </div>
              )}
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
                No layouts configured yet.{" "}
                <Link href="/admin/layouts" className="underline">Add layouts</Link>{" "}
                to track per-hole par values, or import without one.
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
