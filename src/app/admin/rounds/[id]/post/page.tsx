"use client";

import { useState, useEffect, use } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { generateFacebookPost } from "@/lib/post-generator";
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
  post: { content: string } | null;
}

export default function PostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [round, setRound] = useState<Round | null>(null);
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch(`/api/rounds/${id}`)
      .then((r) => r.json())
      .then((data: Round) => {
        setRound(data);

        if (data.post?.content) {
          setContent(data.post.content);
        } else {
          const blueTop3 = data.results.filter((r) => r.division === "BLUE").slice(0, 3).map((r) => ({
            name: r.player.name, score: r.score, relativeScore: r.relativeScore, position: r.position,
          }));
          const redTop3 = data.results.filter((r) => r.division === "RED").slice(0, 3).map((r) => ({
            name: r.player.name, score: r.score, relativeScore: r.relativeScore, position: r.position,
          }));
          const generated = generateFacebookPost({
            weekNumber: data.weekNumber,
            date: new Date(data.date),
            totalPlayers: data.results.length,
            blueTop3,
            redTop3,
            ctpWinners: data.ctpWinners,
          });
          setContent(generated);
        }
      });
  }, [id]);

  async function handleSave() {
    setSaving(true);
    await fetch(`/api/posts/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });
    setSaving(false);
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  function handleRegenerate() {
    if (!round) return;
    const blueTop3 = round.results.filter((r) => r.division === "BLUE").slice(0, 3).map((r) => ({
      name: r.player.name, score: r.score, relativeScore: r.relativeScore, position: r.position,
    }));
    const redTop3 = round.results.filter((r) => r.division === "RED").slice(0, 3).map((r) => ({
      name: r.player.name, score: r.score, relativeScore: r.relativeScore, position: r.position,
    }));
    setContent(generateFacebookPost({
      weekNumber: round.weekNumber,
      date: new Date(round.date),
      totalPlayers: round.results.length,
      blueTop3,
      redTop3,
      ctpWinners: round.ctpWinners,
    }));
  }

  if (!round) return <div className="text-slate-500">Loading...</div>;

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <Link href={`/admin/rounds/${id}`} className="text-sm text-slate-500 hover:text-slate-700">
            ← Manage Round
          </Link>
          <h1 className="text-2xl font-bold text-slate-900 mt-1">
            Week {round.weekNumber} — Facebook Post
          </h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleRegenerate}>
            ↺ Regenerate
          </Button>
          <Button variant="outline" onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save Draft"}
          </Button>
          <Button onClick={handleCopy}>
            {copied ? "✓ Copied!" : "Copy to Clipboard"}
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm text-slate-600">
            Edit the post below, then copy it to paste into Facebook.
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={28}
            className="font-sans text-sm leading-relaxed resize-none"
          />
        </CardContent>
      </Card>

      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
        <p className="text-xs text-slate-500 font-medium uppercase tracking-wide mb-2">Preview</p>
        <div className="text-sm whitespace-pre-wrap text-slate-800 leading-relaxed">
          {content}
        </div>
      </div>
    </div>
  );
}
