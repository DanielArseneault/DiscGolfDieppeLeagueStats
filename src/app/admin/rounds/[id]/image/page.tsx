"use client";

import { useState, useEffect, useRef, use } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { NewspaperPreview } from "@/components/newspaper/newspaper-preview";
import { generateNewspaperBody } from "@/lib/post-generator";
import Link from "next/link";

interface Round {
  id: number;
  weekNumber: number;
  date: string;
  results: {
    position: number;
    division: string;
    player: { name: string };
    score: number;
    relativeScore: number;
  }[];
  ctpWinners: { hole: number; playerName: string }[];
  newspaperImage: {
    headline: string;
    dateline: string | null;
    bodyText: string | null;
    photoUrls: string[];
    caption: string | null;
    closingText: string | null;
  } | null;
}

export default function NewspaperImagePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const previewRef = useRef<HTMLDivElement>(null);

  const [round, setRound] = useState<Round | null>(null);
  const [headline, setHeadline] = useState("");
  const [dateline, setDateline] = useState("");
  const [bodyText, setBodyText] = useState("");
  const [caption, setCaption] = useState("");
  const [closingText, setClosingText] = useState("A special thank you to Atlantic Disc Golf for their continued support of the ADGDDGMSL Championship Series. Same discin' time, same discin' place!");
  const [photos, setPhotos] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    fetch(`/api/rounds/${id}`)
      .then((r) => r.json())
      .then((data: Round) => {
        setRound(data);

        if (data.newspaperImage) {
          setHeadline(data.newspaperImage.headline ?? `WEEK ${data.weekNumber} RESULTS`);
          setDateline(data.newspaperImage.dateline ?? "");
          setBodyText(data.newspaperImage.bodyText ?? "");
          setCaption(data.newspaperImage.caption ?? "");
          setClosingText(data.newspaperImage.closingText ?? closingText);
          // Don't restore photoUrls — blob URLs are session-only
        } else {
          setHeadline(`WEEK ${data.weekNumber} RESULTS`);
          const blueTop3 = data.results.filter((r) => r.division === "BLUE").slice(0, 3).map((r) => ({
            name: r.player.name, score: r.score, relativeScore: r.relativeScore, position: r.position,
          }));
          const redTop3 = data.results.filter((r) => r.division === "RED").slice(0, 3).map((r) => ({
            name: r.player.name, score: r.score, relativeScore: r.relativeScore, position: r.position,
          }));
          const body = generateNewspaperBody({
            weekNumber: data.weekNumber,
            date: new Date(data.date),
            totalPlayers: data.results.length,
            blueTop3,
            redTop3,
            ctpWinners: data.ctpWinners,
          });
          setBodyText(body);
        }
      });
  }, [id]);

  function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    const slots = Math.min(files.length, 3 - photos.length);
    const urls = files.slice(0, slots).map((f) => URL.createObjectURL(f));
    setPhotos([...photos, ...urls]);
    e.target.value = "";
  }

  function handlePhotoRemove(index: number) {
    URL.revokeObjectURL(photos[index]);
    setPhotos(photos.filter((_, j) => j !== index));
  }

  async function handleSave() {
    setSaving(true);
    await fetch(`/api/newspaper/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ headline, dateline, bodyText, caption, closingText, photoUrls: [] }),
    });
    setSaving(false);
  }

  async function handleGenerate() {
    if (!previewRef.current) return;
    setGenerating(true);

    await handleSave();

    try {
      const html2canvas = (await import("html2canvas")).default;
      const canvas = await html2canvas(previewRef.current, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: "#f5f0e8",
      });
      const url = canvas.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = url;
      a.download = `week-${round?.weekNumber}-results.png`;
      a.click();

      await fetch(`/api/newspaper/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ headline, dateline, bodyText, caption, closingText, photoUrls: [], markGenerated: true }),
      });
    } finally {
      setGenerating(false);
    }
  }

  if (!round) return <div className="text-slate-500">Loading...</div>;

  return (
    <div className="space-y-6">
      {/* Load Google Fonts for newspaper */}
      <link
        href="https://fonts.googleapis.com/css2?family=UnifrakturMaguntia&family=Playfair+Display:wght@700;900&family=EB+Garamond:ital,wght@0,400;0,600;1,400&display=swap"
        rel="stylesheet"
      />

      <div className="flex items-center justify-between">
        <div>
          <Link href={`/admin/rounds/${id}`} className="text-sm text-slate-500 hover:text-slate-700">
            ← Manage Round
          </Link>
          <h1 className="text-2xl font-bold text-slate-900 mt-1">
            Week {round.weekNumber} — Newspaper Image
          </h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save Draft"}
          </Button>
          <Button onClick={handleGenerate} disabled={generating}>
            {generating ? "Generating..." : "Download PNG"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-[1fr_420px] gap-6 items-start">
        {/* Preview */}
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

        {/* Controls */}
        <div className="space-y-5 sticky top-4">
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
                <div>
                  <Input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handlePhotoUpload}
                  />
                </div>
              )}
              <div className="space-y-1">
                <Label className="text-xs">Photo Caption</Label>
                <Input value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Caption text..." />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Dateline / Opening Paragraph</CardTitle>
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
                rows={12}
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
    </div>
  );
}
