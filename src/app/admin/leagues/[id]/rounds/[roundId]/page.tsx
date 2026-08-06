"use client";

import { useState, useEffect, use, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { computePoolSummaries } from "@/lib/pool-utils";
import { normalizeTagInput, BOB_TAG, tagRank } from "@/lib/tags";
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

interface CheckInPlayer {
  id: number;
  name: string;
  gender: string | null;
  currentTag: string | null;
}

interface CheckIn {
  id: number;
  playerId: number;
  division: "BLUE" | "RED";
  acePot: boolean;
  paid: boolean;
  paymentMethod: "CASH" | "TAP" | null;
  paymentAmount: number | null;
  player: CheckInPlayer;
}

interface MergedPlayerRow {
  playerId: number;
  playerName: string;
  gender: string | null;
  division: "BLUE" | "RED";
  checkInId: number | null;
  resultId: number | null;
  currentTag: string | null;
  score: number | null;
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
  checkIns: CheckIn[];
  league: { acePotPrice: number; priceWithTag: number; priceWithoutTag: number };
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

function checkInAmount(
  currentTag: string | null,
  acePot: boolean,
  league: { priceWithTag: number; priceWithoutTag: number; acePotPrice: number }
) {
  const base = currentTag ? league.priceWithTag : league.priceWithoutTag;
  return Math.round(base + (acePot ? league.acePotPrice : 0));
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

  // Players tab state — sign-in/payment + tag ladder, all keyed by playerId
  // so the two merge into one row per player regardless of which side (a
  // RoundCheckIn, a Result, or both) actually backs that row.
  const [checkInAcePot, setCheckInAcePot] = useState<Record<number, boolean>>({});
  const [checkInPaid, setCheckInPaid] = useState<Record<number, boolean>>({});
  const [checkInPaymentMethods, setCheckInPaymentMethods] = useState<Record<number, "CASH" | "TAP" | "">>({});
  const [addingCheckIn, setAddingCheckIn] = useState(false);
  const [checkInError, setCheckInError] = useState("");

  const [tagBefores, setTagBefores] = useState<Record<number, string>>({});
  const [tagAfters, setTagAfters] = useState<Record<number, string>>({});
  const [leftEarlys, setLeftEarlys] = useState<Record<number, boolean>>({});
  const [checkInSaving, setCheckInSaving] = useState(false);
  const [resultsSaving, setResultsSaving] = useState(false);
  const [autoAssigning, setAutoAssigning] = useState(false);
  const [tagError, setTagError] = useState("");
  const [tagSort, setTagSort] = useState<{ field: "position" | "name" | "tagAfter"; dir: "asc" | "desc" }>({
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

  // Remove player state
  const [removingResult, setRemovingResult] = useState<RoundResult | null>(null);
  const [removingPlayer, setRemovingPlayer] = useState(false);

  // Round date
  const [roundDate, setRoundDate] = useState("");

  // Edit Round dialog — date, draft status, UDisc URL, all in one place
  const [editRoundOpen, setEditRoundOpen] = useState(false);
  const [editIsDraft, setEditIsDraft] = useState(false);
  const [editRoundSaving, setEditRoundSaving] = useState(false);

  // Facebook link state
  const [facebookUrl, setFacebookUrl] = useState("");
  const [facebookLabel, setFacebookLabel] = useState("");
  const [facebookSaving, setFacebookSaving] = useState(false);

  // UDisc sync state
  const [udiscUrl, setUdiscUrl] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ blueCount: number; redCount: number; syncedAt: string } | null>(null);
  const [syncError, setSyncError] = useState("");
  const [syncInfo, setSyncInfo] = useState("");

  async function load() {
    const data: Round = await fetch(`/api/rounds/${roundId}`).then((r) => r.json());
    setRound(data);
    setRoundDate(new Date(data.date).toISOString().slice(0, 10));
    setEditIsDraft(data.isDraft);

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
      befores[r.playerId] = r.tagBefore != null ? String(r.tagBefore) : "";
      afters[r.playerId] = r.tagAfter != null ? String(r.tagAfter) : "";
      leftEarly[r.playerId] = r.leftEarly;
    }
    setTagBefores(befores);
    setTagAfters(afters);
    setLeftEarlys(leftEarly);

    const ciAcePot: Record<number, boolean> = {};
    const ciPaid: Record<number, boolean> = {};
    const ciMethods: Record<number, "CASH" | "TAP" | ""> = {};
    for (const c of data.checkIns) {
      ciAcePot[c.playerId] = c.acePot;
      ciPaid[c.playerId] = c.paid;
      ciMethods[c.playerId] = c.paymentMethod ?? "";
    }
    setCheckInAcePot(ciAcePot);
    setCheckInPaid(ciPaid);
    setCheckInPaymentMethods(ciMethods);

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

  // Edit Round dialog — date, draft status, UDisc URL, all in one PATCH
  async function handleSaveRoundEdit() {
    if (!roundDate) return;
    setEditRoundSaving(true);
    await fetch(`/api/rounds/${roundId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: roundDate, isDraft: editIsDraft, udiscUrl }),
    });
    await load();
    setEditRoundSaving(false);
    setEditRoundOpen(false);
  }

  function handleCancelEditRound() {
    if (!round) return;
    setRoundDate(new Date(round.date).toISOString().slice(0, 10));
    setUdiscUrl(round.udiscUrl ?? "");
    setEditIsDraft(round.isDraft);
    setEditRoundOpen(false);
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

  // Backfills a RoundCheckIn for a row that already has a Result but no
  // check-in (e.g. an older round, or someone scored without ever being
  // signed in) — players themselves are brought in by the UDisc sync, not
  // added manually here.
  async function handleAddCheckIn(override: { playerId: number; division: "BLUE" | "RED" }) {
    setAddingCheckIn(true);
    setCheckInError("");
    const res = await fetch(`/api/rounds/${roundId}/check-in`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ playerId: override.playerId, division: override.division }),
    });
    if (!res.ok) {
      const err = await res.json();
      setCheckInError(err.error ?? "Failed to sign in player");
    } else {
      await load();
    }
    setAddingCheckIn(false);
  }

  async function handleRemoveCheckIn(checkInId: number) {
    await fetch(`/api/rounds/${roundId}/check-in/${checkInId}`, { method: "DELETE" });
    await load();
  }

  // Saves both the sign-in/payment fields (RoundCheckIn) and the tag ladder
  // fields (Result) in one action — they're separate models under the hood,
  // but the merged table shows them as one row per player.
  // Check-in tab: sign-in/payment (RoundCheckIn) + the tag a player brought in
  // (Result.tagBefore, recorded at check-in time).
  async function handleSaveCheckIn() {
    if (!round) return;
    setCheckInSaving(true);
    await Promise.all([
      fetch(`/api/rounds/${roundId}/check-in`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          checkIns: round.checkIns.map((c) => {
            const acePot = checkInAcePot[c.playerId] ?? false;
            const paid = checkInPaid[c.playerId] ?? false;
            return {
              id: c.id,
              acePot,
              paid,
              paymentMethod: checkInPaymentMethods[c.playerId] === "TAP" ? "TAP" : "CASH",
              paymentAmount: paid ? checkInAmount(c.player.currentTag, acePot, round.league) : null,
            };
          }),
        }),
      }),
      fetch(`/api/rounds/${roundId}/tags`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tags: round.results.map((r) => ({
            resultId: r.id,
            tagBefore: normalizeTagInput(tagBefores[r.playerId] ?? ""),
          })),
        }),
      }),
    ]);
    await load();
    setCheckInSaving(false);
  }

  // Results tab: the tag a player leaves with (Result.tagAfter) and whether
  // they left early — both only make sense once a Result has been synced.
  async function handleSaveResults() {
    if (!round) return;
    setResultsSaving(true);
    await fetch(`/api/rounds/${roundId}/tags`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tags: round.results.map((r) => ({
          resultId: r.id,
          tagBefore: normalizeTagInput(tagBefores[r.playerId] ?? ""),
          tagAfter: normalizeTagInput(tagAfters[r.playerId] ?? ""),
          leftEarly: leftEarlys[r.playerId] ?? false,
        })),
      }),
    });
    await load();
    setResultsSaving(false);
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

  function sortPlayerRows(rows: MergedPlayerRow[]): MergedPlayerRow[] {
    const { field, dir } = tagSort;
    const sign = dir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      if (field === "name") return sign * a.playerName.localeCompare(b.playerName);
      if (field === "tagAfter") {
        return sign * (tagRank(tagAfters[a.playerId] ?? null) - tagRank(tagAfters[b.playerId] ?? null));
      }
      // Rows without a score yet (no Result synced) sort to the end either way.
      if (a.score == null && b.score == null) return 0;
      if (a.score == null) return 1;
      if (b.score == null) return -1;
      return sign * (a.score - b.score);
    });
  }

  function toggleTagSort(field: "position" | "name" | "tagAfter") {
    setTagSort((prev) =>
      prev.field === field ? { field, dir: prev.dir === "asc" ? "desc" : "asc" } : { field, dir: "asc" }
    );
  }

  function findDuplicateTags(rows: MergedPlayerRow[], tagValues: Record<number, string>): Set<number> {
    // BoB is a shared bucket — any number of players can legitimately hold it —
    // so it's excluded from duplicate detection.
    const counts = new Map<string, number>();
    for (const r of rows) {
      const n = normalizeTagInput(tagValues[r.playerId] ?? "");
      if (n != null && n !== BOB_TAG) counts.set(n, (counts.get(n) ?? 0) + 1);
    }
    const dupeNumbers = new Set([...counts.entries()].filter(([, c]) => c > 1).map(([n]) => n));
    const dupePlayerIds = new Set<number>();
    for (const r of rows) {
      const n = normalizeTagInput(tagValues[r.playerId] ?? "");
      if (n != null && dupeNumbers.has(n)) dupePlayerIds.add(r.playerId);
    }
    return dupePlayerIds;
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

  function openRemovePlayer(result: RoundResult) {
    setEditingResult(null);
    setRemovingResult(result);
  }

  async function handleRemovePlayer() {
    if (!removingResult) return;
    setRemovingPlayer(true);
    await fetch(`/api/rounds/${roundId}/results/${removingResult.id}`, { method: "DELETE" });
    await load();
    setRemovingResult(null);
    setRemovingPlayer(false);
  }

  // One row per player, merging their RoundCheckIn (sign-in/payment, exists
  // pre-round) and Result (score/tags, exists once results are synced) —
  // a player can have either or both.
  const mergedPlayerRows = useMemo(() => {
    const byPlayer = new Map<number, MergedPlayerRow>();
    for (const c of round?.checkIns ?? []) {
      byPlayer.set(c.playerId, {
        playerId: c.playerId,
        playerName: c.player.name,
        gender: c.player.gender,
        division: c.division,
        checkInId: c.id,
        resultId: null,
        currentTag: c.player.currentTag,
        score: null,
      });
    }
    for (const r of round?.results ?? []) {
      const existing = byPlayer.get(r.playerId);
      if (existing) {
        existing.resultId = r.id;
        existing.score = r.score;
        existing.division = r.division as "BLUE" | "RED";
      } else {
        byPlayer.set(r.playerId, {
          playerId: r.playerId,
          playerName: r.player.name,
          gender: r.player.gender,
          division: r.division as "BLUE" | "RED",
          checkInId: null,
          resultId: r.id,
          currentTag: null,
          score: r.score,
        });
      }
    }
    return [...byPlayer.values()];
  }, [round?.checkIns, round?.results]);

  // Shared by the Check-In and Results tabs: both render the same
  // division/gender-grouped player rows, just with different editable
  // columns (Check-In edits sign-in/payment/tagBefore, Results edits
  // tagAfter/score/leftEarly). Tags are only reshuffled within a
  // division/gender pool (see auto-assign), so the same number can
  // legitimately show up in two different pools — duplicate detection is
  // scoped per pool, not across the whole round.
  const playerGroups = useMemo(() => {
    return [
      { label: "🔵 Blue Division", rows: mergedPlayerRows.filter((r) => r.division === "BLUE" && r.gender !== "FEMALE") },
      { label: "🔵 Blue Division — Female", rows: mergedPlayerRows.filter((r) => r.division === "BLUE" && r.gender === "FEMALE") },
      { label: "🔴 Red Division", rows: mergedPlayerRows.filter((r) => r.division === "RED" && r.gender !== "FEMALE") },
      { label: "🔴 Red Division — Female", rows: mergedPlayerRows.filter((r) => r.division === "RED" && r.gender === "FEMALE") },
    ]
      .filter(({ label, rows }) => rows.length > 0 || !label.includes("Female"))
      .map(({ label, rows }) => {
        const sorted = sortPlayerRows(rows);
        return {
          label,
          rows: sorted,
          dupeBefore: findDuplicateTags(sorted, tagBefores),
          dupeAfter: findDuplicateTags(sorted, tagAfters),
        };
      });
  }, [mergedPlayerRows, tagSort, tagBefores, tagAfters]);

  const resultsById = useMemo(() => new Map((round?.results ?? []).map((r) => [r.id, r])), [round?.results]);

  const checkInTotals = useMemo(() => {
    const checkIns = round?.checkIns ?? [];
    let cash = 0;
    let tap = 0;
    let acePot = 0;
    for (const c of checkIns) {
      const isTap = (checkInPaymentMethods[c.playerId] ?? c.paymentMethod ?? "") === "TAP";
      const acePotChecked = checkInAcePot[c.playerId] ?? c.acePot;
      const paid = checkInPaid[c.playerId] ?? c.paid;
      const amount = paid && round ? checkInAmount(c.player.currentTag, acePotChecked, round.league) : 0;
      if (isTap) tap += amount;
      else cash += amount;
      if (acePotChecked) acePot++;
    }
    return { count: checkIns.length, cash, tap, acePot };
  }, [round, checkInPaymentMethods, checkInAcePot, checkInPaid]);
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
            <span className="text-sm text-[var(--ink-muted)]">
              {new Date(round.date).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}
              {" "}· {round.results.length} players
            </span>
            <Button
              size="sm"
              variant="outline"
              className="h-7"
              onClick={handleSyncUdisc}
              disabled={syncing || !round.udiscUrl}
              title={!round.udiscUrl ? "Set the UDisc Event URL via Edit first" : undefined}
            >
              {syncing ? "Syncing..." : "🔄 Sync from UDisc"}
            </Button>
          </div>
          {(syncResult || syncInfo || syncError) && (
            <div className="mt-1">
              {syncResult && (
                <p className="text-sm text-[var(--positive)]">
                  Synced {syncResult.blueCount} Blue / {syncResult.redCount} Red — just now
                </p>
              )}
              {syncInfo && <p className="text-sm text-[var(--tint-warn-fg)]">{syncInfo}</p>}
              {syncError && <p className="text-sm text-red-600">{syncError}</p>}
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => setEditRoundOpen(true)}>
            Edit
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href={`/rounds/${roundId}`}>View Public Page</Link>
          </Button>
        </div>
      </div>

      <Tabs defaultValue="tags">
        <TabsList className="mb-2">
          <TabsTrigger value="tags">
            Check-In
            {round.results.some((r) => r.tagAfter != null) && (
              <span className="ml-1.5 w-1.5 h-1.5 rounded-full bg-[var(--positive)] inline-block" />
            )}
          </TabsTrigger>
          <TabsTrigger value="results">Results</TabsTrigger>
          <TabsTrigger value="prizes">Prizes & Awards</TabsTrigger>
        </TabsList>

        {/* ── RESULTS & CTP ── */}
        <TabsContent value="results" className="space-y-6 mt-4 max-w-3xl">

          {/* Scores, Tag After & Left Early */}
          {(() => {
            const PLAYER_COL_WIDTH = 168;
            const HEADER_H = 36;
            const ROW_H = 52;
            const HEADER_STICKY_TOP = 56;
            const resultsCols = "minmax(3.5rem,1fr) minmax(3.5rem,1fr) minmax(3rem,0.6fr) 2.5rem";
            const anyDupes = playerGroups.some((g) => g.dupeBefore.size > 0 || g.dupeAfter.size > 0);

            // Explicit tabIndex so Tab moves down a column (Tag, then Tag
            // After) instead of the browser's default left-to-right order.
            const tagBeforeTabIndex = new Map<number, number>();
            const tagAfterTabIndex = new Map<number, number>();
            let tabCursor = 1;
            for (const { rows } of playerGroups) {
              for (const r of rows) if (r.resultId) tagBeforeTabIndex.set(r.playerId, tabCursor++);
              for (const r of rows) if (r.resultId) tagAfterTabIndex.set(r.playerId, tabCursor++);
            }

            return (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">📊 Scores & Tag Ladder</CardTitle>
                  <p className="text-xs text-[var(--ink-muted)]">
                    Tag is the number a player brought in — also editable on the Check-In tab, and kept in
                    sync since both tabs share the same data. Tag After and Left Early only exist once a
                    player&apos;s Result is synced. Auto-Assign fills Tag After for everyone from score and
                    the tag they brought in — review before saving.
                  </p>
                </CardHeader>
                <CardContent className="space-y-6">
                  {playerGroups.map(({ label, rows, dupeBefore, dupeAfter }) => (
                    <div key={label}>
                      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--ink-muted)] mb-2">{label}</p>
                      <div
                        className="flex overflow-clip rounded-[var(--r-card)] border"
                        style={{ borderColor: "var(--line)", background: "var(--bg-card)" }}
                      >
                        {/* Frozen: player name — plain flow, never scrolls. */}
                        <div className="shrink-0" style={{ width: PLAYER_COL_WIDTH, borderRight: "1px solid var(--line)" }}>
                          <div
                            className="flex items-center px-3 sticky z-10"
                            style={{ height: HEADER_H, top: HEADER_STICKY_TOP, background: "var(--bg-subtle)" }}
                          >
                            <button
                              type="button"
                              onClick={() => toggleTagSort("name")}
                              className="text-left flex items-center gap-0.5 text-[11px] font-medium text-[var(--ink-muted)] hover:text-[var(--ink)]"
                            >
                              Player{tagSort.field === "name" && (tagSort.dir === "asc" ? " ▲" : " ▼")}
                            </button>
                          </div>
                          {rows.map((r, idx) => (
                            <div
                              key={r.playerId}
                              className="flex items-center px-3"
                              style={{
                                height: ROW_H,
                                background: idx % 2 === 1 ? "var(--row-tint)" : "var(--bg-card)",
                                borderTop: "1px solid var(--line-3)",
                              }}
                            >
                              {r.resultId ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const res = resultsById.get(r.resultId!);
                                    if (res) openScoreEditor(res);
                                  }}
                                  className="text-sm text-[var(--ink)] truncate hover:text-blue-600 hover:underline text-left"
                                >
                                  {r.playerName}
                                </button>
                              ) : (
                                <span className="text-sm text-[var(--ink-muted)] truncate">{r.playerName}</span>
                              )}
                            </div>
                          ))}
                          {rows.length === 0 && (
                            <div className="flex items-center px-3" style={{ height: ROW_H }}>
                              <span className="text-xs text-[var(--ink-muted)]">No players yet.</span>
                            </div>
                          )}
                        </div>

                        {/* Scrollable: editable columns. */}
                        <div className="min-w-0 flex-1">
                          <div>
                            <div
                              className="grid gap-2 px-3 items-center text-[11px] font-medium text-[var(--ink-muted)] sticky z-10"
                              style={{ gridTemplateColumns: resultsCols, height: HEADER_H, top: HEADER_STICKY_TOP, background: "var(--bg-subtle)" }}
                            >
                              <span>Tag</span>
                              <button
                                type="button"
                                onClick={() => toggleTagSort("tagAfter")}
                                className="text-left flex items-center gap-0.5 hover:text-[var(--ink)]"
                              >
                                Tag After{tagSort.field === "tagAfter" && (tagSort.dir === "asc" ? " ▲" : " ▼")}
                              </button>
                              <button
                                type="button"
                                onClick={() => toggleTagSort("position")}
                                className="text-left flex items-center gap-0.5 hover:text-[var(--ink)]"
                              >
                                Score{tagSort.field === "position" && (tagSort.dir === "asc" ? " ▲" : " ▼")}
                              </button>
                              <span className="text-center" title="Left early">Left</span>
                            </div>
                            {rows.map((r, idx) => (
                            <div
                              key={r.playerId}
                              className="grid gap-2 items-center px-3"
                              style={{
                                gridTemplateColumns: resultsCols,
                                height: ROW_H,
                                background: idx % 2 === 1 ? "var(--row-tint)" : "var(--bg-card)",
                                borderTop: "1px solid var(--line-3)",
                              }}
                            >
                              {r.resultId ? (
                                <Input
                                  type="text"
                                  placeholder={`# or ${BOB_TAG}`}
                                  tabIndex={tagBeforeTabIndex.get(r.playerId)}
                                  className={`h-8 max-w-14 text-sm ${dupeBefore.has(r.playerId) ? "border-[var(--tint-warn-fg)]" : ""}`}
                                  value={tagBefores[r.playerId] ?? ""}
                                  onChange={(e) => setTagBefores((prev) => ({ ...prev, [r.playerId]: e.target.value }))}
                                />
                              ) : (
                                <span className="text-xs font-mono text-[var(--ink-muted)]">{r.currentTag ?? "—"}</span>
                              )}

                              {r.resultId ? (
                                <Input
                                  type="text"
                                  placeholder={`# or ${BOB_TAG}`}
                                  tabIndex={tagAfterTabIndex.get(r.playerId)}
                                  className={`h-8 max-w-14 text-sm ${dupeAfter.has(r.playerId) ? "border-[var(--tint-warn-fg)]" : ""}`}
                                  value={tagAfters[r.playerId] ?? ""}
                                  onChange={(e) => setTagAfters((prev) => ({ ...prev, [r.playerId]: e.target.value }))}
                                />
                              ) : (
                                <span className="text-xs text-[var(--ink-muted)]">—</span>
                              )}

                              <span className="text-xs font-mono text-[var(--ink-muted)]">{r.score ?? "—"}</span>

                              {r.resultId ? (
                                <input
                                  type="checkbox"
                                  title="Left early"
                                  className="justify-self-center"
                                  checked={leftEarlys[r.playerId] ?? false}
                                  onChange={(e) => setLeftEarlys((prev) => ({ ...prev, [r.playerId]: e.target.checked }))}
                                />
                              ) : (
                                <span />
                              )}
                            </div>
                            ))}
                            {rows.length === 0 && <div style={{ height: ROW_H }} />}
                          </div>
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
                  <div className="flex items-center gap-3 flex-wrap">
                    <Button size="sm" variant="outline" onClick={handleAutoAssignTags} disabled={autoAssigning}>
                      {autoAssigning ? "Assigning..." : "Auto-Assign New Tags"}
                    </Button>
                    <Button size="sm" onClick={handleSaveResults} disabled={resultsSaving}>
                      {resultsSaving ? "Saving..." : "Save"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })()}

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

        {/* ── CHECK-IN ── */}
        <TabsContent value="tags" className="space-y-6 mt-4 max-w-3xl">
          {/* Sign-in & payment — one row per player */}
          {(() => {
            const anyDupes = playerGroups.some((g) => g.dupeBefore.size > 0);

            // Explicit tabIndex so Tab moves straight down the Tag column
            // instead of the browser's default left-to-right row order. Only
            // rows with a synced Result have anything to tab through.
            const tagTabIndex = new Map<number, number>();
            let tabCursor = 1;
            for (const { rows } of playerGroups) {
              for (const r of rows) if (r.resultId) tagTabIndex.set(r.playerId, tabCursor++);
            }

            // Player name is frozen (plain flow, outside the scroll area) so it
            // stays visible while scrolling right to edit payment/tag.
            const PLAYER_COL_WIDTH = 168;
            const SIGNIN_HEADER_H = 36;
            const SIGNIN_ROW_H = 52;
            // Matches AdminNav's sticky height (h-14) so the table header docks
            // just below the nav bar instead of under it.
            const SIGNIN_HEADER_STICKY_TOP = 56;
            const signinCols = "2.5rem 2.5rem 2.5rem minmax(3.5rem,1fr) minmax(4.5rem,1fr) 2rem";

            return (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">✅ Sign-In & Payment</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {playerGroups.map(({ label, rows, dupeBefore }) => (
                    <div key={label}>
                      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--ink-muted)] mb-2">{label}</p>
                      <div
                        className="flex overflow-clip rounded-[var(--r-card)] border"
                        style={{ borderColor: "var(--line)", background: "var(--bg-card)" }}
                      >
                        {/* Frozen: player name — plain flow, never scrolls. */}
                        <div className="shrink-0" style={{ width: PLAYER_COL_WIDTH, borderRight: "1px solid var(--line)" }}>
                          <div
                            className="flex items-center px-3 sticky z-10"
                            style={{ height: SIGNIN_HEADER_H, top: SIGNIN_HEADER_STICKY_TOP, background: "var(--bg-subtle)" }}
                          >
                            <button
                              type="button"
                              onClick={() => toggleTagSort("name")}
                              className="text-left flex items-center gap-0.5 text-[11px] font-medium text-[var(--ink-muted)] hover:text-[var(--ink)]"
                            >
                              Player{tagSort.field === "name" && (tagSort.dir === "asc" ? " ▲" : " ▼")}
                            </button>
                          </div>
                          {rows.map((r, idx) => (
                            <div
                              key={r.playerId}
                              className="flex items-center px-3"
                              style={{
                                height: SIGNIN_ROW_H,
                                background: idx % 2 === 1 ? "var(--row-tint)" : "var(--bg-card)",
                                borderTop: "1px solid var(--line-3)",
                              }}
                            >
                              <span className="text-sm text-[var(--ink)] truncate">{r.playerName}</span>
                            </div>
                          ))}
                          {rows.length === 0 && (
                            <div className="flex items-center px-3" style={{ height: SIGNIN_ROW_H }}>
                              <span className="text-xs text-[var(--ink-muted)]">No players yet.</span>
                            </div>
                          )}
                        </div>

                        {/* Scrollable: everything editable. */}
                        <div className="min-w-0 flex-1">
                          <div>
                            <div
                              className="grid gap-2 px-3 items-center text-[11px] font-medium text-[var(--ink-muted)] sticky z-10"
                              style={{ gridTemplateColumns: signinCols, height: SIGNIN_HEADER_H, top: SIGNIN_HEADER_STICKY_TOP, background: "var(--bg-subtle)" }}
                            >
                              <span className="text-center" title="Paid">Paid</span>
                              <span className="text-center">Ace</span>
                              <span className="text-center" title="Paid via Tap">Tap</span>
                              <span>Tag</span>
                              <span>Amount</span>
                              <span />
                            </div>
                            {rows.map((r, idx) => (
                            <div
                              key={r.playerId}
                              className="grid gap-2 items-center px-3"
                              style={{
                                gridTemplateColumns: signinCols,
                                height: SIGNIN_ROW_H,
                                background: idx % 2 === 1 ? "var(--row-tint)" : "var(--bg-card)",
                                borderTop: "1px solid var(--line-3)",
                              }}
                            >
                              {r.checkInId ? (
                                <input
                                  type="checkbox"
                                  className="justify-self-center"
                                  checked={checkInPaid[r.playerId] ?? false}
                                  onChange={(e) => setCheckInPaid((prev) => ({ ...prev, [r.playerId]: e.target.checked }))}
                                />
                              ) : (
                                <span />
                              )}

                              {r.checkInId ? (
                                <input
                                  type="checkbox"
                                  className="justify-self-center"
                                  checked={checkInAcePot[r.playerId] ?? false}
                                  onChange={(e) => setCheckInAcePot((prev) => ({ ...prev, [r.playerId]: e.target.checked }))}
                                />
                              ) : (
                                <span />
                              )}

                              {r.checkInId ? (
                                <input
                                  type="checkbox"
                                  className="justify-self-center"
                                  checked={checkInPaymentMethods[r.playerId] === "TAP"}
                                  onChange={(e) =>
                                    setCheckInPaymentMethods((prev) => ({ ...prev, [r.playerId]: e.target.checked ? "TAP" : "" }))
                                  }
                                />
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleAddCheckIn({ playerId: r.playerId, division: r.division })}
                                  disabled={addingCheckIn}
                                  className="text-xs text-[var(--ink-muted)] hover:text-[var(--ink)] underline text-left disabled:opacity-50"
                                >
                                  + Sign in
                                </button>
                              )}

                              {r.resultId ? (
                                <Input
                                  type="text"
                                  placeholder={`# or ${BOB_TAG}`}
                                  tabIndex={tagTabIndex.get(r.playerId)}
                                  className={`h-8 max-w-14 text-sm ${dupeBefore.has(r.playerId) ? "border-[var(--tint-warn-fg)]" : ""}`}
                                  value={tagBefores[r.playerId] ?? ""}
                                  onChange={(e) => setTagBefores((prev) => ({ ...prev, [r.playerId]: e.target.value }))}
                                />
                              ) : (
                                <span className="text-xs font-mono text-[var(--ink-muted)]">{r.currentTag ?? "—"}</span>
                              )}

                              {r.checkInId ? (
                                <span className="text-sm tabular-nums">
                                  {checkInPaid[r.playerId]
                                    ? `$${checkInAmount(r.currentTag, checkInAcePot[r.playerId] ?? false, round!.league)}`
                                    : "—"}
                                </span>
                              ) : (
                                <span className="text-xs text-[var(--ink-muted)]">—</span>
                              )}

                              {r.checkInId ? (
                                <button
                                  type="button"
                                  onClick={() => handleRemoveCheckIn(r.checkInId!)}
                                  className="text-[var(--ink-muted)] hover:text-red-500 text-sm"
                                  aria-label={`Remove ${r.playerName}`}
                                >
                                  ✕
                                </button>
                              ) : (
                                <span />
                              )}
                            </div>
                            ))}
                            {rows.length === 0 && <div style={{ height: SIGNIN_ROW_H }} />}
                          </div>
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

                  {checkInError && <p className="text-sm text-red-600">{checkInError}</p>}

                  <p className="text-sm text-[var(--ink-muted)]">
                    {checkInTotals.count} checked in · ${checkInTotals.cash} cash · $
                    {checkInTotals.tap} tap · {checkInTotals.acePot} ace pot
                  </p>

                  <div className="flex items-center gap-3 flex-wrap">
                    <Button size="sm" onClick={handleSaveCheckIn} disabled={checkInSaving}>
                      {checkInSaving ? "Saving..." : "Save"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })()}
        </TabsContent>
      </Tabs>

      {/* Edit Round Dialog */}
      <Dialog open={editRoundOpen} onOpenChange={(open) => { if (!open) handleCancelEditRound(); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base">Edit Round</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Date</Label>
              <Input type="date" value={roundDate} onChange={(e) => setRoundDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">UDisc Event URL</Label>
              <Input
                type="url"
                value={udiscUrl}
                onChange={(e) => setUdiscUrl(e.target.value)}
                placeholder="https://udisc.com/events/..."
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-[var(--ink-2)]">
              <input
                type="checkbox"
                checked={editIsDraft}
                onChange={(e) => setEditIsDraft(e.target.checked)}
              />
              Mark as draft
            </label>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={handleCancelEditRound} disabled={editRoundSaving}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleSaveRoundEdit} disabled={editRoundSaving || !roundDate}>
              {editRoundSaving ? "Saving..." : "Save"}
            </Button>
          </div>
          <div className="pt-4 mt-2 border-t border-[var(--line)]">
            <Button variant="destructive" onClick={handleDelete} disabled={deleting} size="sm">
              {deleting ? "Deleting..." : "Delete Round"}
            </Button>
            <p className="text-xs text-[var(--ink-muted)] mt-1">
              Permanently deletes all results for this round.
            </p>
          </div>
        </DialogContent>
      </Dialog>

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
              <Button
                variant="ghost"
                size="sm"
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                onClick={() => editingResult && openRemovePlayer(editingResult)}
              >
                Remove from Round
              </Button>
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

      {/* Remove Player Confirmation Dialog */}
      <Dialog open={!!removingResult} onOpenChange={(open) => { if (!open) setRemovingResult(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base">Remove Player</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-[var(--ink-2)]">
            Remove <span className="font-semibold">{removingResult?.player.name}</span> from this round? Their
            score and tag data for this round will be permanently deleted and standings will be recalculated.
            This cannot be undone. If they&apos;re listed as a CTP, ace, or round/pool winner, update that
            separately.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setRemovingResult(null)} disabled={removingPlayer}>
              Cancel
            </Button>
            <Button variant="destructive" size="sm" onClick={handleRemovePlayer} disabled={removingPlayer}>
              {removingPlayer ? "Removing..." : "Remove Player"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
