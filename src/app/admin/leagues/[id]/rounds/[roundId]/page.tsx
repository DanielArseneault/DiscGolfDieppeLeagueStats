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

interface CtpWinner {
  hole: number;
  playerName: string;
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
}

interface RoundResult {
  id: number;
  playerId: number;
  position: number;
  division: string;
  player: { name: string };
  score: number;
  relativeScore: number;
}

interface Round {
  id: number;
  weekNumber: number;
  isChampionship: boolean;
  date: string;
  notes: string | null;
  results: RoundResult[];
  ctpWinners: CtpWinner[];
  aceWinners: AceWinner[];
  poolWinners: SavedPoolWinner[];
  post: { content: string } | null;
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
  "A special thank you to Atlantic Disc Golf for their continued support of the ADGDDGMSL Championship Series. Same discin' time, same discin' place!";

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
  const [poolWinnerSaving, setPoolWinnerSaving] = useState(false);

  // CTP state
  const [ctpEntries, setCtpEntries] = useState([
    { player: "", hole: 18 },
    { player: "", hole: 18 },
  ]);
  const [ctpSaving, setCtpSaving] = useState(false);

  // Ace state
  const [aceEntries, setAceEntries] = useState<{ player: string; hole: number; prizeAmount: string }[]>([]);
  const [aceSaving, setAceSaving] = useState(false);

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

    const loaded = data.ctpWinners.map((w) => ({ player: w.playerName, hole: w.hole }));
    while (loaded.length < 2) loaded.push({ player: "", hole: 18 });
    setCtpEntries(loaded);

    setAceEntries(data.aceWinners.map((w) => ({
      player: w.playerName,
      hole: w.hole,
      prizeAmount: w.prizeAmount != null ? String(w.prizeAmount) : "",
    })));

    if (data.isChampionship) {
      const sData: PlayerStanding[] = await fetch(`/api/standings?leagueId=${leagueId}`).then((r) => r.json());
      setStandings(sData);

      const overrides: Record<string, string> = {};
      for (const w of data.poolWinners) overrides[`${w.pool}-${w.place}`] = w.playerName;
      setPoolWinnerOverrides(overrides);

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
      .map((e) => ({ hole: e.hole, playerName: e.player }));
    await fetch(`/api/rounds/${roundId}/ctp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ctpWinners: winners }),
    });
    await load();
    setCtpSaving(false);
  }

  // Pool winners
  async function handleSavePoolWinners() {
    setPoolWinnerSaving(true);
    const winners = Object.entries(poolWinnerOverrides)
      .filter(([, name]) => name)
      .map(([key, playerName]) => {
        const [pool, placeStr] = key.split("-");
        return { pool, place: Number(placeStr), playerName };
      });
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

  const blueResults = useMemo(() => round?.results.filter((r) => r.division === "BLUE") ?? [], [round?.results]);
  const redResults = useMemo(() => round?.results.filter((r) => r.division === "RED") ?? [], [round?.results]);
  const poolData = useMemo(
    () => round?.isChampionship ? computePoolGroups(round.results, standings) : null,
    [round?.isChampionship, round?.results, standings]
  );

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
          <h1 className="text-2xl font-bold text-slate-900 mt-1">
            {round.isChampionship ? "Championship" : `Week ${round.weekNumber}`}
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
                                  <span className="text-slate-900">{r.player.name}</span>
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
                                  <span className="text-slate-500">{r.player.name}</span>
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
                                  <span className="text-slate-500">{r.player.name}</span>
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
                    return (
                      <div key={label}>
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">{label}</p>
                        <ol className="space-y-1">
                          {visible.map((r) => (
                            <li key={r.id} className="text-sm flex items-center gap-2">
                              <span className="text-slate-400 w-4">{r.position}.</span>
                              <span className="text-slate-900">{r.player.name}</span>
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
                        <div className="space-y-1.5">
                          <Label className="text-xs flex items-center gap-1.5">
                            🥇 1st Place
                            {firstOverridden && <span className="text-amber-500 font-normal">(overridden)</span>}
                          </Label>
                          <Select
                            value={currentFirst}
                            onValueChange={(v) => setPoolWinnerOverrides((prev) => ({ ...prev, [`${g.pool}-1`]: v }))}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select..." />
                            </SelectTrigger>
                            <SelectContent>
                              {g.results.map((r) => (
                                <SelectItem key={`${r.id}-1`} value={r.player.name}>
                                  {r.player.name} ({r.score})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs flex items-center gap-1.5">
                            🥈 2nd Place
                            {secondOverridden && <span className="text-amber-500 font-normal">(overridden)</span>}
                          </Label>
                          <Select
                            value={currentSecond}
                            onValueChange={(v) => setPoolWinnerOverrides((prev) => ({ ...prev, [`${g.pool}-2`]: v }))}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select..." />
                            </SelectTrigger>
                            <SelectContent>
                              {g.results.map((r) => (
                                <SelectItem key={`${r.id}-2`} value={r.player.name}>
                                  {r.player.name} ({r.score})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
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
                  <div key={i} className="grid grid-cols-[1fr_90px_auto] gap-3 items-end">
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
                    onClick={() => setCtpEntries((prev) => [...prev, { player: "", hole: 18 }])}
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

          <div className="pt-4 border-t border-slate-200">
            <Button variant="destructive" onClick={handleDelete} disabled={deleting} size="sm">
              {deleting ? "Deleting..." : "Delete Round"}
            </Button>
            <p className="text-xs text-slate-400 mt-1">
              Permanently deletes all results for this round.
            </p>
          </div>
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
    </div>
  );
}
