"use client";

import { useState, useEffect, use, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { computePoolSummaries } from "@/lib/pool-utils";
import { normalizeTagInput, BOB_TAG } from "@/lib/tags";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface CtpWinner {
  hole: number;
  playerName: string;
  prize: string | null;
}

interface AceWinner {
  hole: number;
  playerName: string;
  prizeAmount: number | null;
}

interface SavedPoolWinner {
  pool: string;
  place: number;
  playerName: string;
  prize?: string | null;
}

interface RoundWinnerEntry {
  division: "BLUE" | "RED";
  place: number;
  playerName: string;
  prize?: string;
}

interface HoleParEntry {
  holeNumber: number;
  par: number;
}

interface CourseLayout {
  holePars: HoleParEntry[];
}

interface RoundResult {
  id: number;
  playerId: number;
  position: number;
  division: string;
  player: { name: string; gender: string | null };
  score: number;
  relativeScore: number;
  holeScores: Record<string, number>;
  tagBefore: string | null;
  tagAfter: string | null;
  leftEarly: boolean;
}

interface Round {
  id: number;
  weekNumber: number;
  isChampionship: boolean;
  isDraft: boolean;
  date: string;
  notes: string | null;
  facebookUrl: string | null;
  facebookLabel: string | null;
  udiscUrl: string | null;
  results: RoundResult[];
  ctpWinners: CtpWinner[];
  aceWinners: AceWinner[];
  poolWinners: SavedPoolWinner[];
  roundWinners: RoundWinnerEntry[];
  bobTag: { playerName: string } | null;
  blueLayout: CourseLayout | null;
  redLayout: CourseLayout | null;
}

interface PlayerStanding {
  playerId: number;
  playerName: string;
  championshipPool: string | null;
}

interface PoolGroup {
  pool: string;
  label: string;
  results: RoundResult[];
}

function computePoolGroups(
  results: RoundResult[],
  standings: PlayerStanding[]
): { groups: PoolGroup[]; blueUnqualified: RoundResult[]; redUnqualified: RoundResult[] } {
  const poolMap = new Map<number, string>();
  for (const s of standings) {
    if (s.championshipPool) poolMap.set(s.playerId, s.championshipPool);
  }

  const buckets: Record<string, RoundResult[]> = { A: [], B: [], C: [], D: [] };
  const blueUnqualified: RoundResult[] = [];
  const redUnqualified: RoundResult[] = [];

  for (const r of results) {
    const pool = poolMap.get(r.playerId);
    if (pool) buckets[pool].push(r);
    else if (r.division === "BLUE") blueUnqualified.push(r);
    else redUnqualified.push(r);
  }

  const poolLabels: Record<string, string> = { A: "🔵 Pool A", B: "🔵 Pool B", C: "🔴 Pool C", D: "🔴 Pool D" };

  const groups = (["A", "B", "C", "D"] as const)
    .filter((p) => buckets[p].length > 0)
    .map((p) => ({
      pool: p,
      label: poolLabels[p],
      results: [...buckets[p]].sort((a, b) => a.relativeScore - b.relativeScore),
    }));

  return {
    groups,
    blueUnqualified: [...blueUnqualified].sort((a, b) => a.relativeScore - b.relativeScore),
    redUnqualified: [...redUnqualified].sort((a, b) => a.relativeScore - b.relativeScore),
  };
}

export default function RoundManagePage({
  params,
}: {
  params: Promise<{ id: string; roundId: string }>;
}) {
  const { id: leagueId, roundId } = use(params);
  const router = useRouter();

  const [round, setRound] = useState<Round | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [resultsExpanded, setResultsExpanded] = useState(false);
  const [draftToggling, setDraftToggling] = useState(false);

  // Championship pool state
  const [standings, setStandings] = useState<PlayerStanding[]>([]);
  // keyed by "${pool}-${place}", e.g. "A-1", "A-2"
  const [poolWinnerOverrides, setPoolWinnerOverrides] = useState<Record<string, string>>({});
  const [poolWinnerPrizes, setPoolWinnerPrizes] = useState<Record<string, string>>({});
  const [poolWinnerSaving, setPoolWinnerSaving] = useState(false);

  // CTP state
  const [ctpEntries, setCtpEntries] = useState([
    { player: "", hole: 18, prize: "" },
    { player: "", hole: 18, prize: "" },
  ]);
  const [ctpSaving, setCtpSaving] = useState(false);

  // Ace state
  const [aceEntries, setAceEntries] = useState<{ player: string; hole: number; prizeAmount: string }[]>([]);
  const [aceSaving, setAceSaving] = useState(false);

  // BOB Tag state
  const [bobPlayer, setBobPlayer] = useState("");
  const [bobSaving, setBobSaving] = useState(false);

  // Tag ladder state — keyed by resultId
  const [tagBefores, setTagBefores] = useState<Record<number, string>>({});
  const [tagAfters, setTagAfters] = useState<Record<number, string>>({});
  const [leftEarlys, setLeftEarlys] = useState<Record<number, boolean>>({});
  const [tagsSaving, setTagsSaving] = useState(false);
  const [autoAssigning, setAutoAssigning] = useState(false);
  const [tagError, setTagError] = useState("");
  const [tagSort, setTagSort] = useState<{ field: "position" | "name"; dir: "asc" | "desc" }>({
    field: "name",
    dir: "asc",
  });

  // Round winner overrides (non-championship)
  // 1st place: one per division; 2nd place: multiple allowed (ties)
  const [roundWinner1st, setRoundWinner1st] = useState<Record<string, string>>({ BLUE: "", RED: "" });
  const [roundWinner1stPrize, setRoundWinner1stPrize] = useState<Record<string, string>>({ BLUE: "", RED: "" });
  const [roundWinner2nds, setRoundWinner2nds] = useState<{ division: "BLUE" | "RED"; playerName: string; prize: string }[]>([]);
  const [roundWinnerSaving, setRoundWinnerSaving] = useState(false);

  // Score editor state
  const [editingResult, setEditingResult] = useState<RoundResult | null>(null);
  const [editScores, setEditScores] = useState<Record<string, number>>({});
  const [scoreSaving, setScoreSaving] = useState(false);

  // Round date
  const [roundDate, setRoundDate] = useState("");
  const [dateSaving, setDateSaving] = useState(false);

  // Facebook link state
  const [facebookUrl, setFacebookUrl] = useState("");
  const [facebookLabel, setFacebookLabel] = useState("");
  const [facebookSaving, setFacebookSaving] = useState(false);

  // UDisc sync state
  const [udiscUrl, setUdiscUrl] = useState("");
  const [udiscSaving, setUdiscSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ blueCount: number; redCount: number; syncedAt: string } | null>(null);
  const [syncError, setSyncError] = useState("");
  const [syncInfo, setSyncInfo] = useState("");

  async function load() {
    const data: Round = await fetch(`/api/rounds/${roundId}`).then((r) => r.json());
    setRound(data);
    setRoundDate(new Date(data.date).toISOString().slice(0, 10));

    const loaded = data.ctpWinners.map((w) => ({ player: w.playerName, hole: w.hole, prize: w.prize ?? "" }));
    while (loaded.length < 2) loaded.push({ player: "", hole: 18, prize: "" });
    setCtpEntries(loaded);

    setAceEntries(data.aceWinners.map((w) => ({
      player: w.playerName,
      hole: w.hole,
      prizeAmount: w.prizeAmount != null ? String(w.prizeAmount) : "",
    })));

    setBobPlayer(data.bobTag?.playerName ?? "");

    const befores: Record<number, string> = {};
    const afters: Record<number, string> = {};
    const leftEarly: Record<number, boolean> = {};
    for (const r of data.results) {
      befores[r.id] = r.tagBefore != null ? String(r.tagBefore) : "";
      afters[r.id] = r.tagAfter != null ? String(r.tagAfter) : "";
      leftEarly[r.id] = r.leftEarly;
    }
    setTagBefores(befores);
    setTagAfters(afters);
    setLeftEarlys(leftEarly);
    setFacebookUrl(data.facebookUrl ?? "");
    setFacebookLabel(data.facebookLabel ?? "");
    setUdiscUrl(data.udiscUrl ?? "");

    const w1st: Record<string, string> = { BLUE: "", RED: "" };
    const w1stPrize: Record<string, string> = { BLUE: "", RED: "" };
    const w2nds: { division: "BLUE" | "RED"; playerName: string; prize: string }[] = [];
    for (const w of data.roundWinners ?? []) {
      if (w.place === 1) { w1st[w.division] = w.playerName; w1stPrize[w.division] = w.prize ?? ""; }
      else if (w.place === 2) w2nds.push({ division: w.division as "BLUE" | "RED", playerName: w.playerName, prize: w.prize ?? "" });
    }
    // Pre-populate 1st place from scorecard if no override is saved
    if (!w1st.BLUE) w1st.BLUE = data.results.filter((r: RoundResult) => r.division === "BLUE").find((r: RoundResult) => r.position === 1)?.player.name ?? "";
    if (!w1st.RED) w1st.RED = data.results.filter((r: RoundResult) => r.division === "RED").find((r: RoundResult) => r.position === 1)?.player.name ?? "";
    setRoundWinner1st(w1st);
    setRoundWinner1stPrize(w1stPrize);
    setRoundWinner2nds(w2nds);

    if (data.isChampionship) {
      const sData: PlayerStanding[] = await fetch(`/api/standings?leagueId=${leagueId}`).then((r) => r.json());
      setStandings(sData);

      const overrides: Record<string, string> = {};
      const prizes: Record<string, string> = {};
      for (const w of data.poolWinners) {
        overrides[`${w.pool}-${w.place}`] = w.playerName;
        if (w.prize) prizes[`${w.pool}-${w.place}`] = w.prize;
      }
      setPoolWinnerOverrides(overrides);
      setPoolWinnerPrizes(prizes);
    }
  }

  useEffect(() => {
    load();
  }, [roundId]);

  // Round date
  async function handleSaveDate() {
    if (!roundDate) return;
    setDateSaving(true);
    await fetch(`/api/rounds/${roundId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: roundDate }),
    });
    await load();
    setDateSaving(false);
  }

  // Facebook link
  async function handleSaveFacebook() {
    setFacebookSaving(true);
    await fetch(`/api/rounds/${roundId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ facebookUrl, facebookLabel }),
    });
    await load();
    setFacebookSaving(false);
  }

  // UDisc sync
  async function handleSaveUdiscUrl() {
    setUdiscSaving(true);
    await fetch(`/api/rounds/${roundId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ udiscUrl }),
    });
    await load();
    setUdiscSaving(false);
  }

  async function handleSyncUdisc() {
    setSyncing(true);
    setSyncError("");
    setSyncInfo("");
    setSyncResult(null);
    try {
      const res = await fetch(`/api/rounds/${roundId}/sync-udisc`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setSyncError(data.error ?? "Sync failed");
        return;
      }
      if (data.message) {
        setSyncInfo(data.message);
      } else {
        setSyncResult({ blueCount: data.blueCount, redCount: data.redCount, syncedAt: data.syncedAt });
        await load();
      }
    } catch {
      setSyncError("Failed to sync. Try again in a moment.");
    } finally {
      setSyncing(false);
    }
  }

  // Round winner overrides
  async function handleSaveRoundWinners() {
    setRoundWinnerSaving(true);
    const winners: RoundWinnerEntry[] = [
      ...Object.entries(roundWinner1st)
        .filter(([, name]) => name.trim())
        .map(([div, name]) => ({ division: div as "BLUE" | "RED", place: 1, playerName: name.trim(), prize: roundWinner1stPrize[div]?.trim() || undefined })),
      ...roundWinner2nds
        .filter((w) => w.playerName.trim())
        .map((w) => ({ division: w.division, place: 2, playerName: w.playerName.trim(), prize: w.prize?.trim() || undefined })),
    ];
    await fetch(`/api/rounds/${roundId}/winners`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roundWinners: winners }),
    });
    await load();
    setRoundWinnerSaving(false);
  }

  // Ace
  async function handleSaveAce() {
    setAceSaving(true);
    const winners = aceEntries
      .filter((e) => e.player)
      .map((e) => ({
        hole: e.hole,
        playerName: e.player,
        prizeAmount: e.prizeAmount ? Number(e.prizeAmount) : null,
      }));
    await fetch(`/api/rounds/${roundId}/ace`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ aceWinners: winners }),
    });
    await load();
    setAceSaving(false);
  }

  // CTP
  async function handleSaveCtp() {
    setCtpSaving(true);
    const winners = ctpEntries
      .filter((e) => e.player)
      .map((e) => ({ hole: e.hole, playerName: e.player, prize: e.prize.trim() || undefined }));
    await fetch(`/api/rounds/${roundId}/ctp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ctpWinners: winners }),
    });
    await load();
    setCtpSaving(false);
  }

  // BOB Tag
  async function handleSaveBob() {
    setBobSaving(true);
    if (bobPlayer.trim()) {
      await fetch(`/api/rounds/${roundId}/bob`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerName: bobPlayer.trim() }),
      });
    } else {
      await fetch(`/api/rounds/${roundId}/bob`, { method: "DELETE" });
    }
    await load();
    setBobSaving(false);
  }

  async function handleSaveTags() {
    if (!round) return;
    setTagsSaving(true);
    await fetch(`/api/rounds/${roundId}/tags`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tags: round.results.map((r) => ({
          resultId: r.id,
          tagBefore: normalizeTagInput(tagBefores[r.id] ?? ""),
          tagAfter: normalizeTagInput(tagAfters[r.id] ?? ""),
          leftEarly: leftEarlys[r.id] ?? false,
        })),
      }),
    });
    await load();
    setTagsSaving(false);
  }

  async function handleAutoAssignTags() {
    setAutoAssigning(true);
    setTagError("");
    const res = await fetch(`/api/rounds/${roundId}/tags/auto-assign`, { method: "POST" });
    if (!res.ok) {
      const err = await res.json();
      setTagError(err.error ?? "Failed to auto-assign tags");
    } else {
      await load();
    }
    setAutoAssigning(false);
  }

  function sortTagResults(results: RoundResult[]): RoundResult[] {
    const { field, dir } = tagSort;
    const sign = dir === "asc" ? 1 : -1;
    return [...results].sort((a, b) => {
      if (field === "name") return sign * a.player.name.localeCompare(b.player.name);
      return sign * (a.position - b.position);
    });
  }

  function toggleTagSort(field: "position" | "name") {
    setTagSort((prev) =>
      prev.field === field ? { field, dir: prev.dir === "asc" ? "desc" : "asc" } : { field, dir: "asc" }
    );
  }

  function findDuplicateTags(results: RoundResult[], tagValues: Record<number, string>): Set<number> {
    // BoB is a shared bucket — any number of players can legitimately hold it —
    // so it's excluded from duplicate detection.
    const counts = new Map<string, number>();
    for (const r of results) {
      const n = normalizeTagInput(tagValues[r.id] ?? "");
      if (n != null && n !== BOB_TAG) counts.set(n, (counts.get(n) ?? 0) + 1);
    }
    const dupeNumbers = new Set([...counts.entries()].filter(([, c]) => c > 1).map(([n]) => n));
    const dupeResultIds = new Set<number>();
    for (const r of results) {
      const n = normalizeTagInput(tagValues[r.id] ?? "");
      if (n != null && dupeNumbers.has(n)) dupeResultIds.add(r.id);
    }
    return dupeResultIds;
  }

  // Pool winners
  async function handleSavePoolWinners() {
    setPoolWinnerSaving(true);
    const winners: { pool: string; place: number; playerName: string; prize?: string }[] = [];
    if (poolData) {
      for (const g of poolData.groups) {
        const computedFirst = g.results[0]?.player.name ?? "";
        const computedSecond = g.results.find((r) => r.player.name !== computedFirst)?.player.name ?? "";
        for (const [place, computedName] of [[1, computedFirst], [2, computedSecond]] as const) {
          const key = `${g.pool}-${place}`;
          const playerName = poolWinnerOverrides[key] || computedName;
          const prize = poolWinnerPrizes[key]?.trim() || undefined;
          if (playerName) winners.push({ pool: g.pool, place, playerName, prize });
        }
      }
    }
    await fetch(`/api/rounds/${roundId}/pool-winners`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ poolWinners: winners }),
    });
    await load();
    setPoolWinnerSaving(false);
  }

  async function handleDelete() {
    if (!confirm("Delete this round and all its results?")) return;
    setDeleting(true);
    await fetch(`/api/rounds/${roundId}`, { method: "DELETE" });
    router.push(`/admin/leagues/${leagueId}`);
  }

  async function handleToggleDraft() {
    if (!round) return;
    setDraftToggling(true);
    await fetch(`/api/rounds/${roundId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isDraft: !round.isDraft }),
    });
    await load();
    setDraftToggling(false);
  }

  function openScoreEditor(result: RoundResult) {
    setEditingResult(result);
    const scores: Record<string, number> = {};
    for (const [k, v] of Object.entries(result.holeScores)) {
      const n = Number(v);
      if (n > 0) scores[k] = n;
    }
    setEditScores(scores);
  }

  async function handleSaveScores() {
    if (!editingResult) return;
    setScoreSaving(true);
    await fetch(`/api/rounds/${roundId}/results/${editingResult.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ holeScores: editScores }),
    });
    await load();
    setEditingResult(null);
    setScoreSaving(false);
  }

  const blueResults = useMemo(() => round?.results.filter((r) => r.division === "BLUE") ?? [], [round?.results]);
  const redResults = useMemo(() => round?.results.filter((r) => r.division === "RED") ?? [], [round?.results]);
  const poolData = useMemo(
    () => round?.isChampionship ? computePoolGroups(round.results, standings) : null,
    [round?.isChampionship, round?.results, standings]
  );

  const editLayout = editingResult?.division === "BLUE" ? round?.blueLayout : round?.redLayout;
  const editHoles = useMemo(() => {
    const pars = editLayout?.holePars;
    return pars?.length
      ? [...pars].sort((a, b) => a.holeNumber - b.holeNumber)
      : Array.from({ length: 18 }, (_, i) => ({ holeNumber: i + 1, par: 3 }));
  }, [editLayout]);
  const editTotal = Object.values(editScores).reduce((s, v) => s + v, 0);
  const editTotalPar = editHoles.reduce((s, h) => s + h.par, 0);
  const editRelative = editTotal - editTotalPar;
  const editMidpoint = Math.ceil(editHoles.length / 2);
  const editFront = editHoles.slice(0, editMidpoint);
  const editBack = editHoles.slice(editMidpoint);

  if (!round) {
    return (
      <div className="space-y-6 max-w-6xl">
        <div className="space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-8 w-48" />
        </div>
        <div className="grid grid-cols-3 gap-4">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-20 w-full rounded-lg" />)}
        </div>
        <Skeleton className="h-10 w-64 rounded-md" />
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
        </div>
      </div>
    );
  }

  // Compute current champion names (override or computed) for display
  const currentSummaries = round.isChampionship && standings.length > 0
    ? computePoolSummaries(round.results, standings, Object.entries(poolWinnerOverrides).map(([key, name]) => {
        const [pool, placeStr] = key.split("-");
        return { pool, place: Number(placeStr), playerName: name };
      }))
    : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link href={`/admin/leagues/${leagueId}`} className="text-sm text-[var(--ink-muted)] hover:text-[var(--ink-2)]">
            ← League Dashboard
          </Link>
          <h1 className="text-2xl font-bold text-[var(--ink)] mt-1 flex items-center gap-2">
            {round.isChampionship ? "Championship" : `Week ${round.weekNumber}`}
            {round.isDraft && (
              <span className="text-xs font-medium uppercase tracking-wide text-[var(--tint-warn-fg)] bg-[var(--tint-warn-bg)] border border-[var(--tint-warn-fg)] rounded px-1.5 py-0.5">
                Draft
              </span>
            )}
          </h1>
          <div className="flex flex-wrap items-center gap-2 mt-0.5">
            <Input
              type="date"
              value={roundDate}
              onChange={(e) => setRoundDate(e.target.value)}
              className="h-7 w-40 text-sm"
            />
            {roundDate !== new Date(round.date).toISOString().slice(0, 10) && (
              <Button size="sm" className="h-7" onClick={handleSaveDate} disabled={dateSaving}>
                {dateSaving ? "Saving..." : "Save"}
              </Button>
            )}
            <span className="text-sm text-[var(--ink-muted)]">· {round.results.length} players</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={handleToggleDraft} disabled={draftToggling}>
            {draftToggling ? "Saving..." : round.isDraft ? "Remove Draft" : "Mark as Draft"}
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href={`/rounds/${roundId}`}>View Public Page</Link>
          </Button>
        </div>
      </div>

      <Tabs defaultValue="results">
        <TabsList className="mb-2">
          <TabsTrigger value="results">Results</TabsTrigger>
          <TabsTrigger value="prizes">Prizes & Awards</TabsTrigger>
          <TabsTrigger value="tags">
            Tags
            {round.results.some((r) => r.tagAfter != null) && (
              <span className="ml-1.5 w-1.5 h-1.5 rounded-full bg-[var(--positive)] inline-block" />
            )}
          </TabsTrigger>
        </TabsList>

        {/* ── RESULTS & CTP ── */}
        <TabsContent value="results" className="space-y-6 mt-4 max-w-3xl">

          {/* UDisc Sync */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">🔄 Sync from UDisc</CardTitle>
              <p className="text-xs text-[var(--ink-muted)]">
                Pull the latest leaderboard from a UDisc event URL. Safe to re-run any time — existing results are updated, not duplicated.
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs">UDisc Event URL</Label>
                <Input
                  type="url"
                  value={udiscUrl}
                  onChange={(e) => setUdiscUrl(e.target.value)}
                  placeholder="https://udisc.com/events/..."
                />
              </div>
              <div className="flex items-center gap-3">
                {udiscUrl !== (round.udiscUrl ?? "") && (
                  <Button size="sm" variant="outline" onClick={handleSaveUdiscUrl} disabled={udiscSaving}>
                    {udiscSaving ? "Saving..." : "Save URL"}
                  </Button>
                )}
                <Button size="sm" onClick={handleSyncUdisc} disabled={syncing || !round.udiscUrl}>
                  {syncing ? "Syncing..." : "Sync Now"}
                </Button>
              </div>
              {syncResult && (
                <p className="text-sm text-[var(--positive)]">
                  Synced {syncResult.blueCount} Blue / {syncResult.redCount} Red — just now
                </p>
              )}
              {syncInfo && <p className="text-sm text-[var(--tint-warn-fg)]">{syncInfo}</p>}
              {syncError && <p className="text-sm text-red-600">{syncError}</p>}
            </CardContent>
          </Card>

          {/* Results summary */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Results Summary</CardTitle>
                {!round.isChampionship && (blueResults.length > 5 || redResults.length > 5) && (
                  <button
                    onClick={() => setResultsExpanded((v) => !v)}
                    className="text-xs text-[var(--ink-muted)] hover:text-[var(--ink)] transition-colors"
                  >
                    {resultsExpanded ? "Show less ↑" : "Show all ↓"}
                  </button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {round.isChampionship && poolData ? (
                <div className="space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    {poolData.groups.map((g) => {
                      const summary = currentSummaries.find((s) => s.pool === g.pool);
                      const firstName = summary?.first?.playerName;
                      const secondName = summary?.second?.playerName;
                      return (
                        <div key={g.pool}>
                          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--tint-warn-fg)] mb-2">{g.label}</p>
                          <ol className="space-y-1">
                            {g.results.map((r) => {
                              const isFirst = r.player.name === firstName;
                              const isSecond = r.player.name === secondName;
                              return (
                                <li key={r.id} className={`text-sm flex items-center gap-2 ${isFirst || isSecond ? "font-semibold" : ""}`}>
                                  <span className="w-5 text-center">
                                    {isFirst ? "🥇" : isSecond ? "🥈" : <span className="text-[var(--ink-muted)]">·</span>}
                                  </span>
                                  <button
                                    onClick={() => openScoreEditor(r)}
                                    className="text-[var(--ink)] hover:text-blue-600 hover:underline text-left"
                                  >
                                    {r.player.name}
                                  </button>
                                  <span className="ml-auto font-mono text-xs text-[var(--ink-muted)]">{r.score}</span>
                                </li>
                              );
                            })}
                          </ol>
                        </div>
                      );
                    })}
                  </div>
                  {(poolData.blueUnqualified.length > 0 || poolData.redUnqualified.length > 0) && (
                    <div className="pt-3 border-t border-[var(--line-2)]">
                      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--ink-muted)] mb-3">Did Not Qualify</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                        {poolData.blueUnqualified.length > 0 && (
                          <div>
                            <p className="text-xs text-[var(--ink-muted)] mb-1">🔵 Blue</p>
                            <ol className="space-y-1">
                              {poolData.blueUnqualified.map((r, i) => (
                                <li key={r.id} className="text-sm flex items-center gap-2">
                                  <span className="text-[var(--ink-muted)] w-4">{i + 1}.</span>
                                  <button
                                    onClick={() => openScoreEditor(r)}
                                    className="text-[var(--ink-muted)] hover:text-blue-600 hover:underline text-left"
                                  >
                                    {r.player.name}
                                  </button>
                                  <span className="ml-auto font-mono text-xs text-[var(--ink-muted)]">{r.score}</span>
                                </li>
                              ))}
                            </ol>
                          </div>
                        )}
                        {poolData.redUnqualified.length > 0 && (
                          <div>
                            <p className="text-xs text-[var(--ink-muted)] mb-1">🔴 Red</p>
                            <ol className="space-y-1">
                              {poolData.redUnqualified.map((r, i) => (
                                <li key={r.id} className="text-sm flex items-center gap-2">
                                  <span className="text-[var(--ink-muted)] w-4">{i + 1}.</span>
                                  <button
                                    onClick={() => openScoreEditor(r)}
                                    className="text-[var(--ink-muted)] hover:text-blue-600 hover:underline text-left"
                                  >
                                    {r.player.name}
                                  </button>
                                  <span className="ml-auto font-mono text-xs text-[var(--ink-muted)]">{r.score}</span>
                                </li>
                              ))}
                            </ol>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  {[
                    { label: "🔵 Blue Division", results: blueResults },
                    { label: "🔴 Red Division", results: redResults },
                  ].map(({ label, results }) => {
                    const visible = resultsExpanded ? results : results.slice(0, 5);
                    const posCounts = results.reduce<Record<number, number>>((acc, r) => {
                      acc[r.position] = (acc[r.position] ?? 0) + 1;
                      return acc;
                    }, {});
                    return (
                      <div key={label}>
                        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--ink-muted)] mb-2">{label}</p>
                        <ol className="space-y-1">
                          {visible.map((r) => (
                            <li key={r.id} className="text-sm flex items-center gap-2">
                              <span className="text-[var(--ink-muted)] w-7 shrink-0 tabular-nums">
                                {posCounts[r.position] > 1 ? `T${r.position}` : `${r.position}.`}
                              </span>
                              <button
                                onClick={() => openScoreEditor(r)}
                                className="text-[var(--ink)] hover:text-blue-600 hover:underline text-left"
                              >
                                {r.player.name}
                              </button>
                              <span className="ml-auto font-mono text-xs text-[var(--ink-muted)]">{r.score}</span>
                            </li>
                          ))}
                          {!resultsExpanded && results.length > 5 && (
                            <li className="text-xs text-[var(--ink-muted)]">+{results.length - 5} more</li>
                          )}
                        </ol>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Pool Champions override (championship only) */}
          {round.isChampionship && poolData && poolData.groups.length > 0 && (
            <Card className="border-[var(--tint-warn-fg)]">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">🏆 Pool Champions</CardTitle>
                <p className="text-xs text-[var(--ink-muted)]">
                  Champions are automatically determined by best score. Override here if there&apos;s a tie.
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
                  {poolData.groups.map((g) => {
                    const summary = currentSummaries.find((s) => s.pool === g.pool);
                    const computedFirst = g.results[0]?.player.name ?? "";
                    const computedSecond = g.results.find((r) => r.player.name !== computedFirst)?.player.name ?? "";
                    const currentFirst = poolWinnerOverrides[`${g.pool}-1`] ?? computedFirst;
                    const currentSecond = poolWinnerOverrides[`${g.pool}-2`] ?? computedSecond;
                    const firstOverridden = !!poolWinnerOverrides[`${g.pool}-1`] && poolWinnerOverrides[`${g.pool}-1`] !== computedFirst;
                    const secondOverridden = !!poolWinnerOverrides[`${g.pool}-2`] && poolWinnerOverrides[`${g.pool}-2`] !== computedSecond;

                    void summary;

                    return (
                      <div key={g.pool} className="space-y-3">
                        <p className="text-xs font-semibold text-[var(--ink-2)]">{g.label}</p>
                        {([{ place: 1, label: "🥇 1st Place", current: currentFirst, overridden: firstOverridden }, { place: 2, label: "🥈 2nd Place", current: currentSecond, overridden: secondOverridden }] as const).map(({ place, label, current, overridden }) => (
                          <div key={place} className="space-y-1.5">
                            <Label className="text-xs flex items-center gap-1.5">
                              {label}
                              {overridden && <span className="text-[var(--tint-warn-fg)] font-normal">(overridden)</span>}
                            </Label>
                            <Select
                              value={current}
                              onValueChange={(v) => setPoolWinnerOverrides((prev) => ({ ...prev, [`${g.pool}-${place}`]: v }))}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select..." />
                              </SelectTrigger>
                              <SelectContent>
                                {g.results.map((r) => (
                                  <SelectItem key={`${r.id}-${place}`} value={r.player.name}>
                                    {r.player.name} ({r.score})
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Input
                              placeholder="Prize (e.g. $50 or disc)"
                              value={poolWinnerPrizes[`${g.pool}-${place}`] ?? ""}
                              onChange={(e) => setPoolWinnerPrizes((prev) => ({ ...prev, [`${g.pool}-${place}`]: e.target.value }))}
                            />
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
                <div className="pt-1">
                  <Button size="sm" onClick={handleSavePoolWinners} disabled={poolWinnerSaving}>
                    {poolWinnerSaving ? "Saving..." : "Save Pool Champions"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="pt-4 border-t border-[var(--line)]">
            <Button variant="destructive" onClick={handleDelete} disabled={deleting} size="sm">
              {deleting ? "Deleting..." : "Delete Round"}
            </Button>
            <p className="text-xs text-[var(--ink-muted)] mt-1">
              Permanently deletes all results for this round.
            </p>
          </div>
        </TabsContent>

        {/* ── PRIZES & AWARDS ── */}
        <TabsContent value="prizes" className="space-y-6 mt-4 max-w-3xl">
          {/* CTP */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">🎯 CTP Winners</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {ctpEntries.map((entry, i) => (
                  <div key={i} className="grid grid-cols-1 sm:grid-cols-[1fr_80px_1fr_auto] gap-3 sm:items-end">
                    <div className="space-y-1.5">
                      <Label className="text-xs">CTP {i + 1}</Label>
                      <Select
                        value={entry.player}
                        onValueChange={(v) =>
                          setCtpEntries((prev) => prev.map((e, j) => j === i ? { ...e, player: v } : e))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select player..." />
                        </SelectTrigger>
                        <SelectContent>
                          {round.results.map((r) => (
                            <SelectItem key={r.id} value={r.player.name}>
                              {r.player.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Hole</Label>
                      <Input
                        type="number"
                        min={1}
                        max={18}
                        value={entry.hole}
                        onChange={(e) =>
                          setCtpEntries((prev) => prev.map((en, j) => j === i ? { ...en, hole: Number(e.target.value) } : en))
                        }
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Prize</Label>
                      <Input
                        placeholder="e.g. $20 or disc"
                        value={entry.prize}
                        onChange={(e) =>
                          setCtpEntries((prev) => prev.map((en, j) => j === i ? { ...en, prize: e.target.value } : en))
                        }
                      />
                    </div>
                    {ctpEntries.length > 2 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-[var(--ink-muted)] hover:text-red-500 mb-0.5"
                        onClick={() => setCtpEntries((prev) => prev.filter((_, j) => j !== i))}
                      >
                        ✕
                      </Button>
                    )}
                  </div>
                ))}
                <div className="flex items-center gap-3 pt-1">
                  <Button size="sm" onClick={handleSaveCtp} disabled={ctpSaving}>
                    {ctpSaving ? "Saving..." : "Save CTP Winners"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setCtpEntries((prev) => [...prev, { player: "", hole: 18, prize: "" }])}
                  >
                    + Add CTP
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Aces */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">🦅 Ace Winners</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {aceEntries.length === 0 && (
                  <p className="text-sm text-[var(--ink-muted)]">No aces recorded for this round.</p>
                )}
                {aceEntries.map((entry, i) => (
                  <div key={i} className="grid grid-cols-1 sm:grid-cols-[1fr_80px_120px_auto] gap-3 sm:items-end">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Ace {i + 1}</Label>
                      <Select
                        value={entry.player}
                        onValueChange={(v) =>
                          setAceEntries((prev) => prev.map((e, j) => j === i ? { ...e, player: v } : e))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select player..." />
                        </SelectTrigger>
                        <SelectContent>
                          {round.results.map((r) => (
                            <SelectItem key={r.id} value={r.player.name}>
                              {r.player.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Hole</Label>
                      <Input
                        type="number"
                        min={1}
                        max={18}
                        value={entry.hole}
                        onChange={(e) =>
                          setAceEntries((prev) => prev.map((en, j) => j === i ? { ...en, hole: Number(e.target.value) } : en))
                        }
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Prize ($)</Label>
                      <Input
                        type="number"
                        min={0}
                        step={0.01}
                        placeholder="0.00"
                        value={entry.prizeAmount}
                        onChange={(e) =>
                          setAceEntries((prev) => prev.map((en, j) => j === i ? { ...en, prizeAmount: e.target.value } : en))
                        }
                      />
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-[var(--ink-muted)] hover:text-red-500 mb-0.5"
                      onClick={() => setAceEntries((prev) => prev.filter((_, j) => j !== i))}
                    >
                      ✕
                    </Button>
                  </div>
                ))}
                <div className="flex items-center gap-3 pt-1">
                  <Button size="sm" onClick={handleSaveAce} disabled={aceSaving}>
                    {aceSaving ? "Saving..." : "Save Ace Winners"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setAceEntries((prev) => [...prev, { player: "", hole: 18, prizeAmount: "" }])}
                  >
                    + Add Ace
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* BOB Tag */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">🚌 BOB Tag (Back of the Bus)</CardTitle>
              <p className="text-xs text-[var(--ink-muted)]">
                Who got the BOB Tag this round. Leave blank if nobody got it.
              </p>
            </CardHeader>
            <CardContent>
              <div className="flex gap-3 items-end">
                <div className="flex-1 space-y-1.5">
                  <Label className="text-xs">Player</Label>
                  <Select
                    value={bobPlayer || "__none__"}
                    onValueChange={(v) => setBobPlayer(v === "__none__" ? "" : v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select player..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">— Clear BOB Tag —</SelectItem>
                      {round.results.map((r) => (
                        <SelectItem key={r.id} value={r.player.name}>
                          {r.player.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button size="sm" onClick={handleSaveBob} disabled={bobSaving} className="mb-0.5">
                  {bobSaving ? "Saving..." : "Save BOB Tag"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Round winner overrides (non-championship only) */}
          {!round.isChampionship && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">🥇 Round Winners</CardTitle>
                <p className="text-xs text-[var(--ink-muted)]">
                  Override the displayed 1st and 2nd place winners per division. 2nd place supports multiple players for ties.
                </p>
              </CardHeader>
              <CardContent className="space-y-5">
                {(["BLUE", "RED"] as const).map((div) => {
                  const divResults = round.results.filter((r) => r.division === div);
                  const computed1st = divResults.find((r) => r.position === 1)?.player.name ?? "";
                  const divSeconds = roundWinner2nds.filter((w) => w.division === div);
                  return (
                    <div key={div} className="space-y-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--ink-muted)] border-b pb-1">
                        {div === "BLUE" ? "🔵 Blue Division" : "🔴 Red Division"}
                      </p>
                      {/* 1st place */}
                      <div className="space-y-1">
                        <Label className="text-xs">🥇 1st Place</Label>
                        <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2 sm:items-center">
                          <Input
                            value={roundWinner1st[div] ?? ""}
                            onChange={(e) => setRoundWinner1st((prev) => ({ ...prev, [div]: e.target.value }))}
                            placeholder={computed1st || "1st place player"}
                            list={`players-${div}-1`}
                          />
                          <Input
                            value={roundWinner1stPrize[div] ?? ""}
                            onChange={(e) => setRoundWinner1stPrize((prev) => ({ ...prev, [div]: e.target.value }))}
                            placeholder="Prize (e.g. $20 or disc)"
                          />
                          <div className="w-8" aria-hidden />
                        </div>
                        <datalist id={`players-${div}-1`}>
                          {divResults.map((r) => <option key={r.id} value={r.player.name} />)}
                        </datalist>
                      </div>
                      {/* 2nd place (dynamic list) */}
                      <div className="space-y-2">
                        <Label className="text-xs">🥈 2nd Place</Label>
                        {divSeconds.map((entry, i) => (
                          <div key={i} className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2 sm:items-center">
                            <Input
                              value={entry.playerName}
                              onChange={(e) => {
                                const name = e.target.value;
                                setRoundWinner2nds((prev) => {
                                  let idx = -1;
                                  let count = 0;
                                  for (let j = 0; j < prev.length; j++) {
                                    if (prev[j].division === div) {
                                      if (count === i) { idx = j; break; }
                                      count++;
                                    }
                                  }
                                  if (idx === -1) return prev;
                                  const next = [...prev];
                                  next[idx] = { ...next[idx], playerName: name };
                                  return next;
                                });
                              }}
                              placeholder="Player name"
                              list={`players-${div}-2`}
                            />
                            <Input
                              value={entry.prize}
                              onChange={(e) => {
                                const prize = e.target.value;
                                setRoundWinner2nds((prev) => {
                                  let idx = -1;
                                  let count = 0;
                                  for (let j = 0; j < prev.length; j++) {
                                    if (prev[j].division === div) {
                                      if (count === i) { idx = j; break; }
                                      count++;
                                    }
                                  }
                                  if (idx === -1) return prev;
                                  const next = [...prev];
                                  next[idx] = { ...next[idx], prize };
                                  return next;
                                });
                              }}
                              placeholder="Prize (e.g. $20 or disc)"
                            />
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-[var(--ink-muted)] hover:text-red-500 shrink-0"
                              onClick={() =>
                                setRoundWinner2nds((prev) => {
                                  let count = 0;
                                  return prev.filter((w) => {
                                    if (w.division === div) {
                                      if (count === i) { count++; return false; }
                                      count++;
                                    }
                                    return true;
                                  });
                                })
                              }
                            >
                              ✕
                            </Button>
                          </div>
                        ))}
                        <datalist id={`players-${div}-2`}>
                          {divResults.map((r) => <option key={r.id} value={r.player.name} />)}
                        </datalist>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs"
                          onClick={() => setRoundWinner2nds((prev) => [...prev, { division: div, playerName: "", prize: "" }])}
                        >
                          + Add 2nd Place
                        </Button>
                      </div>
                    </div>
                  );
                })}
                <div className="flex justify-end pt-1">
                  <Button size="sm" onClick={handleSaveRoundWinners} disabled={roundWinnerSaving}>
                    {roundWinnerSaving ? "Saving…" : "Save Winners"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Facebook link */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">📘 Facebook Link</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs">URL</Label>
                <Input
                  type="url"
                  value={facebookUrl}
                  onChange={(e) => setFacebookUrl(e.target.value)}
                  placeholder="https://www.facebook.com/share/p/..."
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Button Label</Label>
                <Input
                  value={facebookLabel}
                  onChange={(e) => setFacebookLabel(e.target.value)}
                  placeholder="More Info"
                  disabled={!facebookUrl}
                />
              </div>
              <p className="text-xs text-[var(--ink-muted)]">Shown as a button on the public round page and round list.</p>
              <Button size="sm" onClick={handleSaveFacebook} disabled={facebookSaving}>
                {facebookSaving ? "Saving..." : "Save Facebook Link"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── TAGS ── */}
        <TabsContent value="tags" className="space-y-6 mt-4 max-w-3xl">
          {(() => {
            // Tags are only reshuffled within a division/gender pool (see auto-assign),
            // so the same number can legitimately show up in two different pools —
            // duplicate detection is scoped per pool, not across the whole round.
            const tagGroups = [
              { label: "🔵 Blue Division", results: blueResults.filter((r) => r.player.gender !== "FEMALE") },
              { label: "🔵 Blue Division — Female", results: blueResults.filter((r) => r.player.gender === "FEMALE") },
              { label: "🔴 Red Division", results: redResults.filter((r) => r.player.gender !== "FEMALE") },
              { label: "🔴 Red Division — Female", results: redResults.filter((r) => r.player.gender === "FEMALE") },
            ]
              .filter(({ label, results }) => results.length > 0 || !label.includes("Female"))
              .map(({ label, results }) => {
                const sorted = sortTagResults(results);
                return {
                  label,
                  results: sorted,
                  dupeBefore: findDuplicateTags(sorted, tagBefores),
                  dupeAfter: findDuplicateTags(sorted, tagAfters),
                };
              });

            const anyDupes = tagGroups.some((g) => g.dupeBefore.size > 0 || g.dupeAfter.size > 0);

            // Explicit tabIndex so Tab moves down a column (Brought In, then
            // Tag After) instead of the browser's default left-to-right order.
            const beforeTabIndex = new Map<number, number>();
            const afterTabIndex = new Map<number, number>();
            let tabCursor = 1;
            for (const { results } of tagGroups) {
              for (const r of results) beforeTabIndex.set(r.id, tabCursor++);
              for (const r of results) afterTabIndex.set(r.id, tabCursor++);
            }

            return (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">🎫 Tag Ladder</CardTitle>
                    <p className="text-xs text-[var(--ink-muted)]">
                      Record tags brought in, then auto-assign reshuffles them per division/gender pool by
                      finish position (ties broken by previous tag). Hover a player&apos;s row to mark them
                      &quot;left early&quot; and set their next tag manually — they&apos;re skipped by auto-assign.
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {tagGroups.map(({ label, results, dupeBefore, dupeAfter }) => (
                      <div key={label}>
                        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--ink-muted)] mb-2">{label}</p>
                        <div className="overflow-x-auto">
                        <div className="space-y-1.5 min-w-[32rem]">
                          <div className="grid grid-cols-[1fr_4rem_6rem_6rem_5rem] gap-2 text-[11px] font-medium text-[var(--ink-muted)] px-1">
                            <button
                              type="button"
                              onClick={() => toggleTagSort("name")}
                              className="text-left flex items-center gap-0.5 hover:text-[var(--ink)]"
                            >
                              Player{tagSort.field === "name" && (tagSort.dir === "asc" ? " ▲" : " ▼")}
                            </button>
                            <button
                              type="button"
                              onClick={() => toggleTagSort("position")}
                              className="text-left flex items-center gap-0.5 hover:text-[var(--ink)]"
                            >
                              Score{tagSort.field === "position" && (tagSort.dir === "asc" ? " ▲" : " ▼")}
                            </button>
                            <span>Brought In</span>
                            <span>Tag After</span>
                            <span />
                          </div>
                          {results.map((r) => (
                            <div
                              key={r.id}
                              className="group grid grid-cols-[1fr_4rem_6rem_6rem_5rem] gap-2 items-center"
                            >
                              <span className="text-sm text-[var(--ink)] truncate">{r.player.name}</span>
                              <span className="text-xs font-mono text-[var(--ink-muted)]">{r.score}</span>
                              <Input
                                type="text"
                                placeholder={`# or ${BOB_TAG}`}
                                tabIndex={beforeTabIndex.get(r.id)}
                                className={`h-8 text-sm ${dupeBefore.has(r.id) ? "border-[var(--tint-warn-fg)]" : ""}`}
                                value={tagBefores[r.id] ?? ""}
                                onChange={(e) =>
                                  setTagBefores((prev) => ({ ...prev, [r.id]: e.target.value }))
                                }
                              />
                              <Input
                                type="text"
                                placeholder={`# or ${BOB_TAG}`}
                                tabIndex={afterTabIndex.get(r.id)}
                                className={`h-8 text-sm ${dupeAfter.has(r.id) ? "border-[var(--tint-warn-fg)]" : ""}`}
                                value={tagAfters[r.id] ?? ""}
                                onChange={(e) =>
                                  setTagAfters((prev) => ({ ...prev, [r.id]: e.target.value }))
                                }
                              />
                              <label
                                className={`flex items-center gap-1.5 text-xs text-[var(--ink-muted)] ${
                                  leftEarlys[r.id] ? "opacity-100" : "opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={leftEarlys[r.id] ?? false}
                                  onChange={(e) =>
                                    setLeftEarlys((prev) => ({ ...prev, [r.id]: e.target.checked }))
                                  }
                                />
                                Left early
                              </label>
                            </div>
                          ))}
                          {results.length === 0 && (
                            <p className="text-xs text-[var(--ink-muted)]">No results yet.</p>
                          )}
                        </div>
                        </div>
                      </div>
                    ))}
                    {anyDupes && (
                      <p className="text-xs text-[var(--tint-warn-fg)]">
                        ⚠ Duplicate tag numbers highlighted above (within the same division/pool) — fix before
                        saving if that wasn&apos;t intentional.
                      </p>
                    )}
                    {tagError && <p className="text-sm text-red-600">{tagError}</p>}
                    <div className="flex items-center gap-3 pt-1 flex-wrap">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleAutoAssignTags}
                        disabled={autoAssigning || round.isDraft}
                        title={round.isDraft ? "Finalize the round (re-import without Draft checked) before auto-assigning" : undefined}
                      >
                        {autoAssigning ? "Assigning..." : "Auto-Assign New Tags"}
                      </Button>
                      <Button size="sm" onClick={handleSaveTags} disabled={tagsSaving}>
                        {tagsSaving ? "Saving..." : "Save Tags"}
                      </Button>
                    </div>
                    {round.isDraft && (
                      <p className="text-xs text-[var(--ink-muted)]">
                        This round is still a draft, so auto-assign is disabled. You can still record tags brought in.
                      </p>
                    )}
                  </CardContent>
                </Card>
              </>
            );
          })()}
        </TabsContent>
      </Tabs>

      {/* Score Editor Dialog */}
      <Dialog open={!!editingResult} onOpenChange={(open) => { if (!open) setEditingResult(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base">
              Edit Scores — {editingResult?.player.name}
              <span className="ml-2 text-xs font-normal text-[var(--ink-muted)]">
                {editingResult?.division === "BLUE" ? "🔵 Blue" : "🔴 Red"}
              </span>
            </DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-x-4 sm:gap-x-6 mt-2">
            {[editFront, editBack].map((group, gi) => (
              <div key={gi}>
                <div className="grid grid-cols-[2.5rem_2.5rem_1fr] gap-x-2 mb-1.5">
                  <span className="text-[11px] font-medium text-[var(--ink-muted)]">Hole</span>
                  <span className="text-[11px] font-medium text-[var(--ink-muted)]">Par</span>
                  <span className="text-[11px] font-medium text-[var(--ink-muted)]">Score</span>
                </div>
                <div className="space-y-1">
                  {group.map((h) => {
                    const val = editScores[String(h.holeNumber)];
                    const diff = val ? val - h.par : 0;
                    return (
                      <div key={h.holeNumber} className="grid grid-cols-[2.5rem_2.5rem_1fr] items-center gap-x-2">
                        <span className="text-xs text-[var(--ink-2)] font-medium">{h.holeNumber}</span>
                        <span className="text-xs text-[var(--ink-muted)]">{h.par}</span>
                        <Input
                          type="number"
                          min={1}
                          max={20}
                          className={`h-7 text-xs tabular-nums ${
                            val && diff < 0
                              ? "border-[var(--positive)] text-[var(--positive)]"
                              : val && diff > 0
                              ? "border-[var(--negative)] text-[var(--negative)]"
                              : ""
                          }`}
                          value={val ?? ""}
                          onChange={(e) => {
                            const n = parseInt(e.target.value);
                            setEditScores((prev) => {
                              const next = { ...prev };
                              if (isNaN(n) || n <= 0) delete next[String(h.holeNumber)];
                              else next[String(h.holeNumber)] = n;
                              return next;
                            });
                          }}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between pt-3 border-t mt-3">
            <div className="text-sm">
              <span className="text-[var(--ink-muted)]">Total: </span>
              <span className="font-semibold text-[var(--ink)]">{editTotal}</span>
              <span className="mx-2 text-[var(--ink-muted)]">·</span>
              <span className={editRelative < 0 ? "font-medium text-[var(--positive)]" : editRelative > 0 ? "font-medium text-[var(--negative)]" : "text-[var(--ink-muted)]"}>
                {editRelative === 0 ? "E" : editRelative > 0 ? `+${editRelative}` : String(editRelative)}
              </span>
              {editLayout && (
                <span className="text-xs text-[var(--ink-muted)] ml-1">vs par {editTotalPar}</span>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setEditingResult(null)}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleSaveScores} disabled={scoreSaving}>
                {scoreSaving ? "Saving..." : "Save Scores"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
