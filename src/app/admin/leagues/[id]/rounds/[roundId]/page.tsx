"use client";

import { useState, useEffect, useRef, use, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { NewspaperPreview } from "@/components/newspaper/newspaper-preview";
import { generateFacebookPost, generateChampionshipPost, generateNewspaperBody } from "@/lib/post-generator";
import { computePoolSummaries } from "@/lib/pool-utils";
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
  player: { name: string };
  score: number;
  relativeScore: number;
  holeScores: Record<string, number>;
  tagBefore: number | null;
  tagAfter: number | null;
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
  results: RoundResult[];
  ctpWinners: CtpWinner[];
  aceWinners: AceWinner[];
  poolWinners: SavedPoolWinner[];
  roundWinners: RoundWinnerEntry[];
  post: { content: string } | null;
  bobTag: { playerName: string } | null;
  blueLayout: CourseLayout | null;
  redLayout: CourseLayout | null;
  newspaperImage: {
    headline: string;
    dateline: string | null;
    bodyText: string | null;
    photoUrls: string[];
    caption: string | null;
    closingText: string | null;
    generatedAt: string | null;
  } | null;
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

const DEFAULT_CLOSING =
  "Thank you to every player and volunteer who made the DDGMSL Championship Series possible. Same discin' time, same discin' place!";

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
  const previewRef = useRef<HTMLDivElement>(null);

  const [round, setRound] = useState<Round | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [resultsExpanded, setResultsExpanded] = useState(false);

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
  const [tagsBeforeSaving, setTagsBeforeSaving] = useState(false);
  const [tagsAfterSaving, setTagsAfterSaving] = useState(false);
  const [autoAssigning, setAutoAssigning] = useState(false);
  const [tagError, setTagError] = useState("");

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

  // Facebook link state
  const [facebookUrl, setFacebookUrl] = useState("");
  const [facebookLabel, setFacebookLabel] = useState("");
  const [facebookSaving, setFacebookSaving] = useState(false);

  // Post state
  const [postContent, setPostContent] = useState("");
  const [postSaving, setPostSaving] = useState(false);
  const [postCopied, setPostCopied] = useState(false);

  // Image state
  const [headline, setHeadline] = useState("");
  const [dateline, setDateline] = useState("");
  const [bodyText, setBodyText] = useState("");
  const [caption, setCaption] = useState("");
  const [closingText, setClosingText] = useState(DEFAULT_CLOSING);
  const [photos, setPhotos] = useState<string[]>([]);
  const [imageSaving, setImageSaving] = useState(false);
  const [imageGenerating, setImageGenerating] = useState(false);

  function buildChampionshipPost(
    data: Round,
    sData: PlayerStanding[],
    overrides: Record<string, string>
  ): string {
    const summaries = computePoolSummaries(data.results, sData, Object.entries(overrides).map(([key, name]) => {
      const [pool, placeStr] = key.split("-");
      return { pool, place: Number(placeStr), playerName: name };
    }));
    return generateChampionshipPost({
      date: new Date(data.date),
      totalPlayers: data.results.length,
      poolResults: summaries.map((s) => ({
        pool: s.pool,
        first: s.first?.playerName ?? null,
        second: s.second?.playerName ?? null,
      })),
      ctpWinners: data.ctpWinners,
      aceWinners: data.aceWinners,
    });
  }

  async function load() {
    const data: Round = await fetch(`/api/rounds/${roundId}`).then((r) => r.json());
    setRound(data);

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
    for (const r of data.results) {
      befores[r.id] = r.tagBefore != null ? String(r.tagBefore) : "";
      afters[r.id] = r.tagAfter != null ? String(r.tagAfter) : "";
    }
    setTagBefores(befores);
    setTagAfters(afters);
    setFacebookUrl(data.facebookUrl ?? "");
    setFacebookLabel(data.facebookLabel ?? "");

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

      setPostContent(data.post?.content ?? buildChampionshipPost(data, sData, overrides));
    } else {
      const blueTop3 = data.results.filter((r) => r.division === "BLUE").slice(0, 3).map((r) => ({
        name: r.player.name, score: r.score, relativeScore: r.relativeScore, position: r.position,
      }));
      const redTop3 = data.results.filter((r) => r.division === "RED").slice(0, 3).map((r) => ({
        name: r.player.name, score: r.score, relativeScore: r.relativeScore, position: r.position,
      }));
      setPostContent(
        data.post?.content ??
          generateFacebookPost({ weekNumber: data.weekNumber, date: new Date(data.date), totalPlayers: data.results.length, blueTop3, redTop3, ctpWinners: data.ctpWinners, aceWinners: data.aceWinners })
      );
    }

    setHeadline(data.newspaperImage?.headline ?? (data.isChampionship ? "CHAMPIONSHIP RESULTS" : `WEEK ${data.weekNumber} RESULTS`));
    setDateline(data.newspaperImage?.dateline ?? "");
    setCaption(data.newspaperImage?.caption ?? "");
    setClosingText(data.newspaperImage?.closingText ?? DEFAULT_CLOSING);

    const blueTop3 = data.results.filter((r) => r.division === "BLUE").slice(0, 3).map((r) => ({
      name: r.player.name, score: r.score, relativeScore: r.relativeScore, position: r.position,
    }));
    const redTop3 = data.results.filter((r) => r.division === "RED").slice(0, 3).map((r) => ({
      name: r.player.name, score: r.score, relativeScore: r.relativeScore, position: r.position,
    }));
    setBodyText(
      data.newspaperImage?.bodyText ??
        generateNewspaperBody({ weekNumber: data.weekNumber, date: new Date(data.date), totalPlayers: data.results.length, blueTop3, redTop3, ctpWinners: data.ctpWinners, aceWinners: data.aceWinners })
    );
  }

  useEffect(() => {
    load();
  }, [roundId]);

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

  // Tag ladder
  function parseTag(v: string): number | null {
    const n = parseInt(v, 10);
    return v.trim() === "" || isNaN(n) ? null : n;
  }

  async function handleSaveTagsBefore() {
    if (!round) return;
    setTagsBeforeSaving(true);
    await fetch(`/api/rounds/${roundId}/tags`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tags: round.results.map((r) => ({ resultId: r.id, tagBefore: parseTag(tagBefores[r.id] ?? "") })),
      }),
    });
    await load();
    setTagsBeforeSaving(false);
  }

  async function handleSaveTagsAfter() {
    if (!round) return;
    setTagsAfterSaving(true);
    await fetch(`/api/rounds/${roundId}/tags`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tags: round.results.map((r) => ({ resultId: r.id, tagAfter: parseTag(tagAfters[r.id] ?? "") })),
      }),
    });
    await load();
    setTagsAfterSaving(false);
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

  function findDuplicateTags(results: RoundResult[], tagValues: Record<number, string>): Set<number> {
    const counts = new Map<number, number>();
    for (const r of results) {
      const n = parseTag(tagValues[r.id] ?? "");
      if (n != null) counts.set(n, (counts.get(n) ?? 0) + 1);
    }
    const dupeNumbers = new Set([...counts.entries()].filter(([, c]) => c > 1).map(([n]) => n));
    const dupeResultIds = new Set<number>();
    for (const r of results) {
      const n = parseTag(tagValues[r.id] ?? "");
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

  // Post
  async function handleSavePost() {
    setPostSaving(true);
    await fetch(`/api/posts/${roundId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: postContent }),
    });
    setPostSaving(false);
  }

  async function handleCopyPost() {
    await navigator.clipboard.writeText(postContent);
    setPostCopied(true);
    setTimeout(() => setPostCopied(false), 2500);
  }

  function handleRegeneratePost() {
    if (!round) return;
    if (round.isChampionship) {
      setPostContent(buildChampionshipPost(round, standings, poolWinnerOverrides));
    } else {
      const blueTop3 = round.results.filter((r) => r.division === "BLUE").slice(0, 3).map((r) => ({
        name: r.player.name, score: r.score, relativeScore: r.relativeScore, position: r.position,
      }));
      const redTop3 = round.results.filter((r) => r.division === "RED").slice(0, 3).map((r) => ({
        name: r.player.name, score: r.score, relativeScore: r.relativeScore, position: r.position,
      }));
      setPostContent(generateFacebookPost({
        weekNumber: round.weekNumber,
        date: new Date(round.date),
        totalPlayers: round.results.length,
        blueTop3,
        redTop3,
        ctpWinners: round.ctpWinners,
        aceWinners: round.aceWinners,
      }));
    }
  }

  // Image
  async function handleSaveImage() {
    setImageSaving(true);
    await fetch(`/api/newspaper/${roundId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ headline, dateline, bodyText, caption, closingText, photoUrls: [] }),
    });
    setImageSaving(false);
  }

  async function handleGenerateImage() {
    if (!previewRef.current) return;
    setImageGenerating(true);
    await handleSaveImage();
    try {
      const html2canvas = (await import("html2canvas")).default;
      const canvas = await html2canvas(previewRef.current, {
        scale: 2, useCORS: true, allowTaint: true, backgroundColor: "#f5f0e8",
      });
      const a = document.createElement("a");
      a.href = canvas.toDataURL("image/png");
      a.download = round?.isChampionship ? "championship-results.png" : `week-${round?.weekNumber}-results.png`;
      a.click();
      await fetch(`/api/newspaper/${roundId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ headline, dateline, bodyText, caption, closingText, photoUrls: [], markGenerated: true }),
      });
    } finally {
      setImageGenerating(false);
    }
  }

  function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    const slots = Math.min(files.length, 3 - photos.length);
    setPhotos([...photos, ...files.slice(0, slots).map((f) => URL.createObjectURL(f))]);
    e.target.value = "";
  }

  function handlePhotoRemove(index: number) {
    URL.revokeObjectURL(photos[index]);
    setPhotos(photos.filter((_, j) => j !== index));
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

  const postDone = !!round.post;
  const imageDone = !!round.newspaperImage?.generatedAt;

  return (
    <div className="space-y-6">
      <link
        href="https://fonts.googleapis.com/css2?family=UnifrakturMaguntia&family=Playfair+Display:wght@700;900&family=EB+Garamond:ital,wght@0,400;0,600;1,400&display=swap"
        rel="stylesheet"
      />

      <div className="flex items-center justify-between">
        <div>
          <Link href={`/admin/leagues/${leagueId}`} className="text-sm text-slate-500 hover:text-slate-700">
            ← League Dashboard
          </Link>
          <h1 className="text-2xl font-bold text-slate-900 mt-1 flex items-center gap-2">
            {round.isChampionship ? "Championship" : `Week ${round.weekNumber}`}
            {round.isDraft && (
              <span className="text-xs font-medium uppercase tracking-wide text-amber-600 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5">
                Draft
              </span>
            )}
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {new Date(round.date).toLocaleDateString("en-CA", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" })}
            {" · "}{round.results.length} players
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href={`/rounds/${roundId}`}>View Public Page</Link>
        </Button>
      </div>

      <Tabs defaultValue="results">
        <TabsList className="mb-2">
          <TabsTrigger value="results">Results, CTP & Aces</TabsTrigger>
          <TabsTrigger value="tags">
            Tags
            {round.results.some((r) => r.tagAfter != null) && (
              <span className="ml-1.5 w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
            )}
          </TabsTrigger>
          <TabsTrigger value="post">
            Facebook Post
            {postDone && <span className="ml-1.5 w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />}
          </TabsTrigger>
          <TabsTrigger value="image">
            Newspaper Image
            {imageDone && <span className="ml-1.5 w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />}
          </TabsTrigger>
        </TabsList>

        {/* ── RESULTS & CTP ── */}
        <TabsContent value="results" className="space-y-6 mt-4 max-w-3xl">

          {/* Results summary */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Results Summary</CardTitle>
                {!round.isChampionship && (blueResults.length > 5 || redResults.length > 5) && (
                  <button
                    onClick={() => setResultsExpanded((v) => !v)}
                    className="text-xs text-slate-500 hover:text-slate-800 transition-colors"
                  >
                    {resultsExpanded ? "Show less ↑" : "Show all ↓"}
                  </button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {round.isChampionship && poolData ? (
                <div className="space-y-5">
                  <div className="grid grid-cols-2 gap-5">
                    {poolData.groups.map((g) => {
                      const summary = currentSummaries.find((s) => s.pool === g.pool);
                      const firstName = summary?.first?.playerName;
                      const secondName = summary?.second?.playerName;
                      return (
                        <div key={g.pool}>
                          <p className="text-xs font-semibold uppercase tracking-wide text-amber-600 mb-2">{g.label}</p>
                          <ol className="space-y-1">
                            {g.results.map((r) => {
                              const isFirst = r.player.name === firstName;
                              const isSecond = r.player.name === secondName;
                              return (
                                <li key={r.id} className={`text-sm flex items-center gap-2 ${isFirst || isSecond ? "font-semibold" : ""}`}>
                                  <span className="w-5 text-center">
                                    {isFirst ? "🥇" : isSecond ? "🥈" : <span className="text-slate-300">·</span>}
                                  </span>
                                  <button
                                    onClick={() => openScoreEditor(r)}
                                    className="text-slate-900 hover:text-blue-600 hover:underline text-left"
                                  >
                                    {r.player.name}
                                  </button>
                                  <span className="ml-auto font-mono text-xs text-slate-500">{r.score}</span>
                                </li>
                              );
                            })}
                          </ol>
                        </div>
                      );
                    })}
                  </div>
                  {(poolData.blueUnqualified.length > 0 || poolData.redUnqualified.length > 0) && (
                    <div className="pt-3 border-t border-slate-100">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-3">Did Not Qualify</p>
                      <div className="grid grid-cols-2 gap-5">
                        {poolData.blueUnqualified.length > 0 && (
                          <div>
                            <p className="text-xs text-slate-400 mb-1">🔵 Blue</p>
                            <ol className="space-y-1">
                              {poolData.blueUnqualified.map((r, i) => (
                                <li key={r.id} className="text-sm flex items-center gap-2">
                                  <span className="text-slate-400 w-4">{i + 1}.</span>
                                  <button
                                    onClick={() => openScoreEditor(r)}
                                    className="text-slate-500 hover:text-blue-600 hover:underline text-left"
                                  >
                                    {r.player.name}
                                  </button>
                                  <span className="ml-auto font-mono text-xs text-slate-400">{r.score}</span>
                                </li>
                              ))}
                            </ol>
                          </div>
                        )}
                        {poolData.redUnqualified.length > 0 && (
                          <div>
                            <p className="text-xs text-slate-400 mb-1">🔴 Red</p>
                            <ol className="space-y-1">
                              {poolData.redUnqualified.map((r, i) => (
                                <li key={r.id} className="text-sm flex items-center gap-2">
                                  <span className="text-slate-400 w-4">{i + 1}.</span>
                                  <button
                                    onClick={() => openScoreEditor(r)}
                                    className="text-slate-500 hover:text-blue-600 hover:underline text-left"
                                  >
                                    {r.player.name}
                                  </button>
                                  <span className="ml-auto font-mono text-xs text-slate-400">{r.score}</span>
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
                <div className="grid grid-cols-2 gap-6">
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
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">{label}</p>
                        <ol className="space-y-1">
                          {visible.map((r) => (
                            <li key={r.id} className="text-sm flex items-center gap-2">
                              <span className="text-slate-400 w-7 shrink-0 tabular-nums">
                                {posCounts[r.position] > 1 ? `T${r.position}` : `${r.position}.`}
                              </span>
                              <button
                                onClick={() => openScoreEditor(r)}
                                className="text-slate-900 hover:text-blue-600 hover:underline text-left"
                              >
                                {r.player.name}
                              </button>
                              <span className="ml-auto font-mono text-xs text-slate-500">{r.score}</span>
                            </li>
                          ))}
                          {!resultsExpanded && results.length > 5 && (
                            <li className="text-xs text-slate-400">+{results.length - 5} more</li>
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
            <Card className="border-amber-200">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">🏆 Pool Champions</CardTitle>
                <p className="text-xs text-slate-500">
                  Champions are automatically determined by best score. Override here if there&apos;s a tie.
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-x-6 gap-y-4">
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
                        <p className="text-xs font-semibold text-slate-700">{g.label}</p>
                        {([{ place: 1, label: "🥇 1st Place", current: currentFirst, overridden: firstOverridden }, { place: 2, label: "🥈 2nd Place", current: currentSecond, overridden: secondOverridden }] as const).map(({ place, label, current, overridden }) => (
                          <div key={place} className="space-y-1.5">
                            <Label className="text-xs flex items-center gap-1.5">
                              {label}
                              {overridden && <span className="text-amber-500 font-normal">(overridden)</span>}
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

          {/* CTP */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">🎯 CTP Winners</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {ctpEntries.map((entry, i) => (
                  <div key={i} className="grid grid-cols-[1fr_80px_1fr_auto] gap-3 items-end">
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
                        className="text-slate-400 hover:text-red-500 mb-0.5"
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
                  <p className="text-sm text-slate-400">No aces recorded for this round.</p>
                )}
                {aceEntries.map((entry, i) => (
                  <div key={i} className="grid grid-cols-[1fr_80px_120px_auto] gap-3 items-end">
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
                      className="text-slate-400 hover:text-red-500 mb-0.5"
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
              <p className="text-xs text-slate-500">
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
                <p className="text-xs text-slate-500">
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
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 border-b pb-1">
                        {div === "BLUE" ? "🔵 Blue Division" : "🔴 Red Division"}
                      </p>
                      {/* 1st place */}
                      <div className="space-y-1">
                        <Label className="text-xs">🥇 1st Place</Label>
                        <div className="grid grid-cols-[1fr_1fr_auto] gap-2 items-center">
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
                          <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-center">
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
                              className="text-slate-400 hover:text-red-500 shrink-0"
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
              <p className="text-xs text-slate-400">Shown as a button on the public round page and round list.</p>
              <Button size="sm" onClick={handleSaveFacebook} disabled={facebookSaving}>
                {facebookSaving ? "Saving..." : "Save Facebook Link"}
              </Button>
            </CardContent>
          </Card>

          <div className="pt-4 border-t border-slate-200">
            <Button variant="destructive" onClick={handleDelete} disabled={deleting} size="sm">
              {deleting ? "Deleting..." : "Delete Round"}
            </Button>
            <p className="text-xs text-slate-400 mt-1">
              Permanently deletes all results for this round.
            </p>
          </div>
        </TabsContent>

        {/* ── TAGS ── */}
        <TabsContent value="tags" className="space-y-6 mt-4 max-w-3xl">
          {(() => {
            const dupeBefore = findDuplicateTags(round.results, tagBefores);
            const dupeAfter = findDuplicateTags(round.results, tagAfters);
            return (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">🎫 Tag Ladder</CardTitle>
                    <p className="text-xs text-slate-500">
                      Record which tag each player checked in with. Once the round is final, auto-assign
                      reshuffles tags per division: among players who brought a tag, the best finisher gets
                      the lowest tag number in that day&apos;s pool, and so on. Players with no tag aren&apos;t
                      part of the shuffle — give a player their first tag by typing a number directly into
                      &quot;Tag After&quot; and saving.
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {[
                      { label: "🔵 Blue Division", results: blueResults },
                      { label: "🔴 Red Division", results: redResults },
                    ].map(({ label, results }) => (
                      <div key={label}>
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">{label}</p>
                        <div className="space-y-1.5">
                          <div className="grid grid-cols-[1fr_4rem_6rem_6rem] gap-2 text-[11px] font-medium text-slate-400 px-1">
                            <span>Player</span>
                            <span>Score</span>
                            <span>Brought In</span>
                            <span>Tag After</span>
                          </div>
                          {results.map((r) => (
                            <div key={r.id} className="grid grid-cols-[1fr_4rem_6rem_6rem] gap-2 items-center">
                              <span className="text-sm text-slate-800 truncate">{r.player.name}</span>
                              <span className="text-xs font-mono text-slate-500">{r.score}</span>
                              <Input
                                type="number"
                                min={1}
                                className={`h-8 text-sm ${dupeBefore.has(r.id) ? "border-amber-400" : ""}`}
                                value={tagBefores[r.id] ?? ""}
                                onChange={(e) =>
                                  setTagBefores((prev) => ({ ...prev, [r.id]: e.target.value }))
                                }
                              />
                              <Input
                                type="number"
                                min={1}
                                className={`h-8 text-sm ${dupeAfter.has(r.id) ? "border-amber-400" : ""}`}
                                value={tagAfters[r.id] ?? ""}
                                onChange={(e) =>
                                  setTagAfters((prev) => ({ ...prev, [r.id]: e.target.value }))
                                }
                              />
                            </div>
                          ))}
                          {results.length === 0 && (
                            <p className="text-xs text-slate-400">No results yet.</p>
                          )}
                        </div>
                      </div>
                    ))}
                    {(dupeBefore.size > 0 || dupeAfter.size > 0) && (
                      <p className="text-xs text-amber-600">
                        ⚠ Duplicate tag numbers highlighted above — fix before saving if that wasn&apos;t intentional.
                      </p>
                    )}
                    {tagError && <p className="text-sm text-red-600">{tagError}</p>}
                    <div className="flex items-center gap-3 pt-1 flex-wrap">
                      <Button size="sm" onClick={handleSaveTagsBefore} disabled={tagsBeforeSaving}>
                        {tagsBeforeSaving ? "Saving..." : "Save Tags Brought In"}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleAutoAssignTags}
                        disabled={autoAssigning || round.isDraft}
                        title={round.isDraft ? "Finalize the round (re-import without Draft checked) before auto-assigning" : undefined}
                      >
                        {autoAssigning ? "Assigning..." : "Auto-Assign New Tags"}
                      </Button>
                      <Button size="sm" variant="outline" onClick={handleSaveTagsAfter} disabled={tagsAfterSaving}>
                        {tagsAfterSaving ? "Saving..." : "Save Tag Changes"}
                      </Button>
                    </div>
                    {round.isDraft && (
                      <p className="text-xs text-slate-400">
                        This round is still a draft, so auto-assign is disabled. You can still record tags brought in.
                      </p>
                    )}
                  </CardContent>
                </Card>
              </>
            );
          })()}
        </TabsContent>

        {/* ── FACEBOOK POST ── */}
        <TabsContent value="post" className="space-y-6 mt-4 max-w-3xl">
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={handleRegeneratePost}>
              ↺ Regenerate
            </Button>
            <Button variant="outline" size="sm" onClick={handleSavePost} disabled={postSaving}>
              {postSaving ? "Saving..." : "Save Draft"}
            </Button>
            <Button size="sm" onClick={handleCopyPost}>
              {postCopied ? "✓ Copied!" : "Copy to Clipboard"}
            </Button>
          </div>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-slate-600">
                Edit the post below, then copy it to paste into Facebook.
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={postContent}
                onChange={(e) => setPostContent(e.target.value)}
                rows={28}
                className="font-sans text-sm leading-relaxed resize-none"
              />
            </CardContent>
          </Card>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wide mb-2">Preview</p>
            <div className="text-sm whitespace-pre-wrap text-slate-800 leading-relaxed">
              {postContent}
            </div>
          </div>
        </TabsContent>

        {/* ── NEWSPAPER IMAGE ── */}
        <TabsContent value="image" className="mt-4">
          <div className="flex justify-end gap-2 mb-6">
            <Button variant="outline" size="sm" onClick={handleSaveImage} disabled={imageSaving}>
              {imageSaving ? "Saving..." : "Save Draft"}
            </Button>
            <Button size="sm" onClick={handleGenerateImage} disabled={imageGenerating}>
              {imageGenerating ? "Generating..." : "Download PNG"}
            </Button>
          </div>

          <div className="grid grid-cols-[1fr_420px] gap-6 items-start">
            <div className="overflow-x-auto">
              <div className="inline-block">
                <NewspaperPreview
                  ref={previewRef}
                  weekNumber={round.weekNumber}
                  headline={headline}
                  dateline={dateline}
                  bodyText={bodyText}
                  caption={caption}
                  closingText={closingText}
                  photos={photos}
                />
              </div>
            </div>

            <div className="space-y-4 sticky top-4">
              <Card>
                <CardHeader className="pb-3"><CardTitle className="text-sm">Headline</CardTitle></CardHeader>
                <CardContent>
                  <Input value={headline} onChange={(e) => setHeadline(e.target.value)} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3"><CardTitle className="text-sm">Photos (up to 3)</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  {photos.map((url, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <img src={url} alt="" className="w-16 h-12 object-cover rounded border" />
                      <Button variant="outline" size="sm" onClick={() => handlePhotoRemove(i)} className="text-red-500 text-xs">Remove</Button>
                    </div>
                  ))}
                  {photos.length < 3 && <Input type="file" accept="image/*" multiple onChange={handlePhotoUpload} />}
                  <div className="space-y-1">
                    <Label className="text-xs">Caption</Label>
                    <Input value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Caption text..." />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3"><CardTitle className="text-sm">Dateline / Opening</CardTitle></CardHeader>
                <CardContent>
                  <Textarea value={dateline} onChange={(e) => setDateline(e.target.value)} rows={3} placeholder="DIEPPE, N.B. — What looked like a washout..." />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3"><CardTitle className="text-sm">Body Text</CardTitle></CardHeader>
                <CardContent>
                  <Textarea value={bodyText} onChange={(e) => setBodyText(e.target.value)} rows={10} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3"><CardTitle className="text-sm">Closing / Sponsor Line</CardTitle></CardHeader>
                <CardContent>
                  <Textarea value={closingText} onChange={(e) => setClosingText(e.target.value)} rows={3} />
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Score Editor Dialog */}
      <Dialog open={!!editingResult} onOpenChange={(open) => { if (!open) setEditingResult(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base">
              Edit Scores — {editingResult?.player.name}
              <span className="ml-2 text-xs font-normal text-slate-500">
                {editingResult?.division === "BLUE" ? "🔵 Blue" : "🔴 Red"}
              </span>
            </DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-x-6 mt-2">
            {[editFront, editBack].map((group, gi) => (
              <div key={gi}>
                <div className="grid grid-cols-[2.5rem_2.5rem_1fr] gap-x-2 mb-1.5">
                  <span className="text-[11px] font-medium text-slate-400">Hole</span>
                  <span className="text-[11px] font-medium text-slate-400">Par</span>
                  <span className="text-[11px] font-medium text-slate-400">Score</span>
                </div>
                <div className="space-y-1">
                  {group.map((h) => {
                    const val = editScores[String(h.holeNumber)];
                    const diff = val ? val - h.par : 0;
                    return (
                      <div key={h.holeNumber} className="grid grid-cols-[2.5rem_2.5rem_1fr] items-center gap-x-2">
                        <span className="text-xs text-slate-600 font-medium">{h.holeNumber}</span>
                        <span className="text-xs text-slate-400">{h.par}</span>
                        <Input
                          type="number"
                          min={1}
                          max={20}
                          className={`h-7 text-xs tabular-nums ${
                            val && diff < 0
                              ? "border-sky-400 text-sky-600"
                              : val && diff > 0
                              ? "border-orange-300 text-orange-500"
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
              <span className="text-slate-500">Total: </span>
              <span className="font-semibold text-slate-800">{editTotal}</span>
              <span className="mx-2 text-slate-300">·</span>
              <span className={editRelative < 0 ? "font-medium text-sky-600" : editRelative > 0 ? "font-medium text-orange-500" : "text-slate-500"}>
                {editRelative === 0 ? "E" : editRelative > 0 ? `+${editRelative}` : String(editRelative)}
              </span>
              {editLayout && (
                <span className="text-xs text-slate-400 ml-1">vs par {editTotalPar}</span>
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
