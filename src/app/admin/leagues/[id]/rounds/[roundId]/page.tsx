"use client";

import { useState, useEffect, useRef, use } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { NewspaperPreview } from "@/components/newspaper/newspaper-preview";
import { generateFacebookPost, generateNewspaperBody } from "@/lib/post-generator";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface CtpWinner {
  hole: number;
  playerName: string;
}

interface RoundResult {
  id: number;
  position: number;
  division: string;
  player: { name: string };
  score: number;
  relativeScore: number;
}

interface Round {
  id: number;
  weekNumber: number;
  date: string;
  notes: string | null;
  results: RoundResult[];
  ctpWinners: CtpWinner[];
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

const DEFAULT_CLOSING =
  "A special thank you to Atlantic Disc Golf for their continued support of the ADGDDGMSL Championship Series. Same discin' time, same discin' place!";

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

  // CTP state
  const [blueCtpPlayer, setBlueCtpPlayer] = useState("");
  const [blueCtpHole, setBlueCtpHole] = useState(18);
  const [redCtpPlayer, setRedCtpPlayer] = useState("");
  const [redCtpHole, setRedCtpHole] = useState(18);
  const [ctpSaving, setCtpSaving] = useState(false);

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

  async function load() {
    const data: Round = await fetch(`/api/rounds/${roundId}`).then((r) => r.json());
    setRound(data);

    if (data.ctpWinners?.length > 0) {
      const blueNames = new Set(data.results.filter((r) => r.division === "BLUE").map((r) => r.player.name));
      const redNames = new Set(data.results.filter((r) => r.division === "RED").map((r) => r.player.name));
      for (const w of data.ctpWinners) {
        if (blueNames.has(w.playerName)) { setBlueCtpPlayer(w.playerName); setBlueCtpHole(w.hole); }
        else if (redNames.has(w.playerName)) { setRedCtpPlayer(w.playerName); setRedCtpHole(w.hole); }
      }
    }

    const blueTop3 = data.results.filter((r) => r.division === "BLUE").slice(0, 3).map((r) => ({
      name: r.player.name, score: r.score, relativeScore: r.relativeScore, position: r.position,
    }));
    const redTop3 = data.results.filter((r) => r.division === "RED").slice(0, 3).map((r) => ({
      name: r.player.name, score: r.score, relativeScore: r.relativeScore, position: r.position,
    }));

    setPostContent(
      data.post?.content ??
        generateFacebookPost({
          weekNumber: data.weekNumber,
          date: new Date(data.date),
          totalPlayers: data.results.length,
          blueTop3,
          redTop3,
          ctpWinners: data.ctpWinners,
        })
    );

    setHeadline(data.newspaperImage?.headline ?? `WEEK ${data.weekNumber} RESULTS`);
    setDateline(data.newspaperImage?.dateline ?? "");
    setCaption(data.newspaperImage?.caption ?? "");
    setClosingText(data.newspaperImage?.closingText ?? DEFAULT_CLOSING);
    setBodyText(
      data.newspaperImage?.bodyText ??
        generateNewspaperBody({
          weekNumber: data.weekNumber,
          date: new Date(data.date),
          totalPlayers: data.results.length,
          blueTop3,
          redTop3,
          ctpWinners: data.ctpWinners,
        })
    );
  }

  useEffect(() => {
    load();
  }, [roundId]);

  // CTP
  async function handleSaveCtp() {
    setCtpSaving(true);
    const winners = [
      blueCtpPlayer ? { hole: blueCtpHole, playerName: blueCtpPlayer } : null,
      redCtpPlayer ? { hole: redCtpHole, playerName: redCtpPlayer } : null,
    ].filter(Boolean);
    await fetch(`/api/rounds/${roundId}/ctp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ctpWinners: winners }),
    });
    await load();
    setCtpSaving(false);
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
    }));
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
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: "#f5f0e8",
      });
      const a = document.createElement("a");
      a.href = canvas.toDataURL("image/png");
      a.download = `week-${round?.weekNumber}-results.png`;
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

  if (!round) return <div className="text-slate-500 py-12 text-center">Loading...</div>;

  const blueResults = round.results.filter((r) => r.division === "BLUE");
  const redResults = round.results.filter((r) => r.division === "RED");

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
          <Link
            href={`/admin/leagues/${leagueId}`}
            className="text-sm text-slate-500 hover:text-slate-700"
          >
            ← League Dashboard
          </Link>
          <h1 className="text-2xl font-bold text-slate-900 mt-1">
            Week {round.weekNumber}
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {new Date(round.date).toLocaleDateString("en-CA", { year: "numeric", month: "long", day: "numeric" })}
            {" · "}{round.results.length} players
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href={`/rounds/${roundId}`}>View Public Page</Link>
        </Button>
      </div>

      <Tabs defaultValue="results">
        <TabsList className="mb-2">
          <TabsTrigger value="results">Results & CTP</TabsTrigger>
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
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Results Summary</CardTitle>
                {(blueResults.length > 5 || redResults.length > 5) && (
                  <button
                    onClick={() => setResultsExpanded((v) => !v)}
                    className="text-xs text-slate-500 hover:text-slate-800 transition-colors"
                  >
                    {resultsExpanded ? "Show less ↑" : `Show all ↓`}
                  </button>
                )}
              </div>
            </CardHeader>
            <CardContent>
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
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">🎯 CTP Winners</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {(
                  [
                    { label: "🔵 Blue Division", players: blueResults, player: blueCtpPlayer, setPlayer: setBlueCtpPlayer, hole: blueCtpHole, setHole: setBlueCtpHole },
                    { label: "🔴 Red Division", players: redResults, player: redCtpPlayer, setPlayer: setRedCtpPlayer, hole: redCtpHole, setHole: setRedCtpHole },
                  ] as const
                ).map(({ label, players, player, setPlayer, hole, setHole }) => (
                  <div key={label} className="grid grid-cols-[1fr_90px] gap-3 items-end">
                    <div className="space-y-1.5">
                      <Label className="text-xs">{label}</Label>
                      <Select value={player} onValueChange={setPlayer}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select player..." />
                        </SelectTrigger>
                        <SelectContent>
                          {players.map((r) => (
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
                        value={hole}
                        onChange={(e) => setHole(Number(e.target.value))}
                      />
                    </div>
                  </div>
                ))}
                <div className="pt-1">
                  <Button size="sm" onClick={handleSaveCtp} disabled={ctpSaving}>
                    {ctpSaving ? "Saving..." : "Save CTP Winners"}
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
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Headline</CardTitle>
                </CardHeader>
                <CardContent>
                  <Input value={headline} onChange={(e) => setHeadline(e.target.value)} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Photos (up to 3)</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {photos.map((url, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <img src={url} alt="" className="w-16 h-12 object-cover rounded border" />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePhotoRemove(i)}
                        className="text-red-500 text-xs"
                      >
                        Remove
                      </Button>
                    </div>
                  ))}
                  {photos.length < 3 && (
                    <Input type="file" accept="image/*" multiple onChange={handlePhotoUpload} />
                  )}
                  <div className="space-y-1">
                    <Label className="text-xs">Caption</Label>
                    <Input
                      value={caption}
                      onChange={(e) => setCaption(e.target.value)}
                      placeholder="Caption text..."
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Dateline / Opening</CardTitle>
                </CardHeader>
                <CardContent>
                  <Textarea
                    value={dateline}
                    onChange={(e) => setDateline(e.target.value)}
                    rows={3}
                    placeholder="DIEPPE, N.B. — What looked like a washout..."
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Body Text</CardTitle>
                </CardHeader>
                <CardContent>
                  <Textarea
                    value={bodyText}
                    onChange={(e) => setBodyText(e.target.value)}
                    rows={10}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Closing / Sponsor Line</CardTitle>
                </CardHeader>
                <CardContent>
                  <Textarea
                    value={closingText}
                    onChange={(e) => setClosingText(e.target.value)}
                    rows={3}
                  />
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
