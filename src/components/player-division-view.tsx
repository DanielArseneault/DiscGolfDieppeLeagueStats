"use client";

import { useState } from "react";
import type { Division } from "@/generated/prisma/enums";
import { MemberStatus } from "@/generated/prisma/enums";
import { toPar, toParAvg, signInk, roundChipTint } from "@/lib/design-helpers";
import { Card, CardContent } from "@/components/site-card";
import { CourseStatsSection } from "@/components/course-stats-grid";
import type { HoleStat } from "@/lib/course-stats";
import Link from "next/link";

export interface DivisionViewData {
  division: Division;
  standing: { rank: number; qualified: boolean; roundsPlayed: number; qualifyingTotal: number } | null;
  chronological: { weekNumber: number; relativeScore: number }[];
  avgScore: number | null;
  bestRound: number | null;
  wins: number;
  top3: number;
  avgRank: number | null;
  percentile: number | null;
  fieldAvgScore: number | null;
  fieldBestRound: number | null;
  fieldAvgRoundsPlayed: number | null;
  fieldBirdieRate: number | null;
  playerHoleStats: HoleStat[] | null;
  fieldHoleStats: HoleStat[] | null;
  roundBreakdown: {
    birdieOrBetterRate: number;
    parRate: number;
    bogeyOrWorseRate: number;
    eagles: number;
    aces: number;
    bestF9: number | null;
    f9Avg: number | null;
    bestB9: number | null;
    b9Avg: number | null;
  } | null;
}

const DIVISION_STYLE: Record<Division, { label: string; dot: string; surface: string; ink: string }> = {
  BLUE: { label: "Blue division", dot: "var(--blue-dot)", surface: "var(--blue-surface)", ink: "var(--blue-ink)" },
  RED: { label: "Red division", dot: "var(--red-dot)", surface: "var(--red-surface)", ink: "var(--red-ink)" },
};

/** Blue/Red division toggle for a player's profile. Mirrors the DivisionPanel pattern on
 *  the homepage: both divisions' view data are precomputed server-side, so switching is a
 *  client-side state flip (no server round-trip), with the URL kept link-shareable via
 *  history.replaceState. Round history and CTP/ace wins live outside this component and
 *  are unaffected by the toggle — they always show every round the player has played. */
export function PlayerDivisionView({
  player,
  league,
  leagueUrl,
  views,
  initialDivision,
}: {
  player: { id: number; name: string; pdgaNumber: string | null; memberStatus: MemberStatus };
  league: { id: number; name: string; year: number };
  leagueUrl: string;
  views: DivisionViewData[];
  initialDivision: Division;
}) {
  const [division, setDivision] = useState(initialDivision);
  const view = views.find((v) => v.division === division) ?? views[0];

  const select = (d: Division) => {
    setDivision(d);
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("division", d === "BLUE" ? "blue" : "red");
      window.history.replaceState(null, "", url);
    } catch {}
  };

  if (!view) return null;

  const style = DIVISION_STYLE[view.division];
  const fieldBirdieRate = view.fieldBirdieRate;

  return (
    <div className="space-y-8">
      <Hero
        player={player}
        leagueId={league.id}
        leagueUrl={leagueUrl}
        views={views}
        activeDivision={division}
        onSelect={views.length > 1 ? select : undefined}
        standing={view.standing}
        chronological={view.chronological}
      />

      {view.standing && (
        <div>
          <SectionTitle>
            {league.name} <span style={{ color: "var(--ink-muted)", fontWeight: 400 }}>· {league.year}</span>
          </SectionTitle>
          <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "1px", background: "var(--line)" }}>
            <StatCell label="Best 4 rounds" value={view.standing.qualified ? String(view.standing.qualifyingTotal) : "–"} />
            <StatCell label="Scoring average" value={view.avgScore != null ? toParAvg(Math.round(view.avgScore * 100) / 100) : "–"} ink={view.avgScore != null ? signInk(view.avgScore) : undefined} />
            <StatCell label="Best round" value={view.bestRound != null ? toPar(view.bestRound) : "–"} ink={view.bestRound != null ? signInk(view.bestRound) : undefined} />
            <StatCell label="Top 3 finishes" value={String(view.top3)} />
          </div>
          {view.percentile != null && (
            <p className="mt-2 text-xs" style={{ color: "var(--ink-muted)" }}>
              {view.wins > 0 ? `${view.wins} win${view.wins !== 1 ? "s" : ""} · ` : ""}
              Top {view.percentile}% of the {style.label.toLowerCase()} · {view.avgRank != null ? `avg. weekly rank #${view.avgRank}` : ""}
            </p>
          )}
        </div>
      )}

      {(view.chronological.length > 0 || view.roundBreakdown) && (
        <div className="grid gap-4 lg:grid-cols-2">
          {view.chronological.length > 1 && (
            <Card>
              <CardContent className="pt-6">
                <p className="mb-3 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[.13em]" style={{ color: "var(--ink-muted)" }}>
                  Score trend
                </p>
                <TrendChart rounds={view.chronological} />
              </CardContent>
            </Card>
          )}
          {view.roundBreakdown && (
            <Card>
              <CardContent className="space-y-4 pt-6">
                <div>
                  <p className="mb-2 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[.13em]" style={{ color: "var(--ink-muted)" }}>
                    Shot mix
                  </p>
                  <ShotMixBar breakdown={view.roundBreakdown} />
                </div>
                {(view.roundBreakdown.bestF9 != null || view.roundBreakdown.bestB9 != null) && (
                  <div className="grid grid-cols-2 gap-x-6 gap-y-3 pt-2 sm:grid-cols-4 sm:gap-x-8" style={{ borderTop: "1px solid var(--line-2)" }}>
                    {view.roundBreakdown.bestF9 != null && <CompactStat label="Best F9" value={toPar(view.roundBreakdown.bestF9)} ink={signInk(view.roundBreakdown.bestF9)} />}
                    {view.roundBreakdown.f9Avg != null && <CompactStat label="F9 avg" value={toParAvg(view.roundBreakdown.f9Avg)} ink={signInk(view.roundBreakdown.f9Avg)} />}
                    {view.roundBreakdown.bestB9 != null && <CompactStat label="Best B9" value={toPar(view.roundBreakdown.bestB9)} ink={signInk(view.roundBreakdown.bestB9)} />}
                    {view.roundBreakdown.b9Avg != null && <CompactStat label="B9 avg" value={toParAvg(view.roundBreakdown.b9Avg)} ink={signInk(view.roundBreakdown.b9Avg)} />}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {view.playerHoleStats && view.chronological.length > 0 && (
        <div>
          <SectionTitle>Hole performance</SectionTitle>
          <CourseStatsSection stats={view.playerHoleStats} fieldStats={view.fieldHoleStats ?? undefined} variant="compact" />
        </div>
      )}

      {view.standing && (
        <div>
          <SectionTitle>How he stacks up</SectionTitle>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StackCard
              label="Scoring average"
              mine={view.avgScore}
              field={view.fieldAvgScore}
              format={(v) => toParAvg(v)}
              reading={(mine, field) =>
                mine < field
                  ? `${(field - mine).toFixed(1)} strokes better than the field average`
                  : mine > field
                  ? `${(mine - field).toFixed(1)} strokes worse than the field average`
                  : "Matches the field average"
              }
              lowerIsBetter
            />
            <StackCard
              label="Best round"
              mine={view.bestRound}
              field={view.fieldBestRound}
              format={(v) => toPar(Math.round(v))}
              reading={(mine, field) => (mine <= field ? "Tied or better than the division's best round" : `${Math.round(mine - field)} strokes off the division's best`)}
              lowerIsBetter
            />
            <StackCard
              label="Birdie or better rate"
              mine={view.roundBreakdown?.birdieOrBetterRate ?? null}
              field={fieldBirdieRate}
              format={(v) => `${v.toFixed(1)}%`}
              reading={(mine, field) => (mine > field ? `${(mine - field).toFixed(1)} pts above the field rate` : mine < field ? `${(field - mine).toFixed(1)} pts below the field rate` : "Matches the field rate")}
            />
            <StackCard
              label="Rounds played"
              mine={view.standing.roundsPlayed}
              field={view.fieldAvgRoundsPlayed}
              format={(v) => v.toFixed(v % 1 === 0 ? 0 : 1)}
              reading={(mine, field) => (mine > field ? "More active than the average field player" : mine < field ? "Fewer rounds than the average field player" : "Matches the field average")}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-4 text-[20px] font-bold tracking-[-0.02em]" style={{ color: "var(--ink)" }}>
      {children}
    </h2>
  );
}

function StatCell({ label, value, ink }: { label: string; value: string; ink?: string }) {
  return (
    <div className="px-5 py-4" style={{ background: "var(--bg-card)" }}>
      <p className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[.13em]" style={{ color: "var(--ink-muted)" }}>
        {label}
      </p>
      <p className="mt-1 font-[family-name:var(--font-mono)] text-[26px] font-medium" style={{ color: ink ?? "var(--ink)" }}>
        {value}
      </p>
    </div>
  );
}

function CompactStat({ label, value, ink }: { label: string; value: string; ink?: string }) {
  return (
    <div>
      <div className="font-[family-name:var(--font-mono)] text-lg font-medium" style={{ color: ink ?? "var(--ink)" }}>
        {value}
      </div>
      <div className="text-xs" style={{ color: "var(--ink-muted)" }}>
        {label}
      </div>
    </div>
  );
}

function Hero({
  player,
  leagueId,
  leagueUrl,
  views,
  activeDivision,
  onSelect,
  standing,
  chronological,
}: {
  player: { id: number; name: string; pdgaNumber: string | null; memberStatus: MemberStatus };
  leagueId: number;
  leagueUrl: string;
  views: DivisionViewData[];
  activeDivision: Division;
  onSelect?: (d: Division) => void;
  standing: { rank: number; qualified: boolean } | null;
  chronological: { weekNumber: number; relativeScore: number }[];
}) {
  const style = DIVISION_STYLE[activeDivision];

  return (
    <div>
      <div className="-mx-8 -mt-14 px-8 pt-24 pb-8" style={{ background: "linear-gradient(to bottom, var(--hero-a), var(--bg-app))" }}>
        <div className="mx-auto max-w-[var(--container)]">
          <div className="flex items-center gap-1.5 font-[family-name:var(--font-mono)] text-xs uppercase tracking-[.14em]" style={{ color: "var(--ink-muted)" }}>
            <Link href={leagueUrl} className="nav-link" style={{ color: "var(--ink-muted)" }}>Standings</Link>
            <span>/</span>
            <span>{player.name}</span>
          </div>

          <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <span
                className="flex h-[76px] w-[76px] shrink-0 items-center justify-center rounded-full font-[family-name:var(--font-mono)] text-2xl font-semibold"
                style={{ background: "var(--accent)", color: "var(--accent-ink)" }}
              >
                {initials(player.name)}
              </span>
              <div>
                <h1 className="text-[32px] font-extrabold sm:text-[42px]" style={{ color: "var(--ink)", letterSpacing: "-0.03em", lineHeight: 1 }}>
                  {player.name}
                </h1>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {onSelect ? (
                    views.map((v) => {
                      const s = DIVISION_STYLE[v.division];
                      const active = v.division === activeDivision;
                      return (
                        <button
                          key={v.division}
                          type="button"
                          onClick={() => onSelect(v.division)}
                          className="inline-flex items-center gap-1.5 rounded-[var(--r-pill)] px-2.5 py-1 font-[family-name:var(--font-mono)] text-xs transition-opacity"
                          style={{ background: s.surface, color: s.ink, opacity: active ? 1 : 0.45 }}
                        >
                          <span className="h-2 w-2 rounded-full" style={{ background: s.dot }} />
                          {s.label}
                        </button>
                      );
                    })
                  ) : (
                    <span
                      className="inline-flex items-center gap-1.5 rounded-[var(--r-pill)] px-2.5 py-1 font-[family-name:var(--font-mono)] text-xs"
                      style={{ background: style.surface, color: style.ink }}
                    >
                      <span className="h-2 w-2 rounded-full" style={{ background: style.dot }} />
                      {style.label}
                    </span>
                  )}
                  {player.memberStatus === MemberStatus.MEMBER && (
                    <span className="rounded-[var(--r-pill)] px-2.5 py-1 font-[family-name:var(--font-mono)] text-xs" style={{ background: "var(--chip-neutral)", color: "var(--ink-2)" }}>
                      Member
                    </span>
                  )}
                  {player.pdgaNumber && (
                    <a href={`https://www.pdga.com/player/${player.pdgaNumber}`} target="_blank" rel="noopener noreferrer" className="nav-link text-xs" style={{ color: "var(--ink-muted)", textDecoration: "underline" }}>
                      PDGA #{player.pdgaNumber}
                    </a>
                  )}
                  <Link
                    href={`/compare?a=${player.id}&league=${leagueId}`}
                    className="nav-link rounded-[var(--r-pill)] px-2.5 py-1 font-[family-name:var(--font-mono)] text-xs"
                    style={{ background: "var(--chip-neutral)", color: "var(--ink-2)" }}
                  >
                    Compare →
                  </Link>
                </div>
              </div>
            </div>

            {standing && (
              <div className="text-right">
                <div className="font-[family-name:var(--font-mono)] text-[64px] font-extrabold leading-none" style={{ color: "var(--positive)" }}>
                  #{standing.rank}
                </div>
                <p className="mt-1 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[.13em]" style={{ color: "var(--ink-muted)" }}>
                  In division
                </p>
                <span
                  className="mt-1 inline-block rounded-[var(--r-pill)] px-2.5 py-0.5 font-[family-name:var(--font-mono)] text-xs"
                  style={standing.qualified ? { background: "var(--accent-soft)", color: "var(--positive)" } : { background: "var(--chip-neutral)", color: "var(--ink-muted)" }}
                >
                  {standing.qualified ? "Qualified" : "Not yet qualified"}
                </span>
              </div>
            )}
          </div>

          {chronological.length > 0 && (
            <div className="mt-6 flex gap-2 overflow-x-auto pb-1">
              {chronological.map((r) => {
                const tint = roundChipTint(r.relativeScore, 0);
                return (
                  <div key={r.weekNumber} className="flex shrink-0 flex-col items-center gap-1">
                    <span className="rounded-[var(--r-chip)] px-2 py-1 font-[family-name:var(--font-mono)] text-xs font-medium" style={{ background: tint.bg, color: tint.fg }}>
                      {toPar(r.relativeScore)}
                    </span>
                    <span className="font-[family-name:var(--font-mono)] text-[10px]" style={{ color: "var(--ink-muted)" }}>
                      W{r.weekNumber}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TrendChart({ rounds }: { rounds: { weekNumber: number; relativeScore: number }[] }) {
  const width = 480;
  const height = 160;
  const padX = 16;
  const padTop = 28;
  const padBottom = 16;
  const values = rounds.map((r) => r.relativeScore);
  const min = Math.min(0, ...values);
  const max = Math.max(0, ...values);
  const range = max - min || 1;
  const x = (i: number) => padX + (i / Math.max(1, rounds.length - 1)) * (width - padX * 2);
  const y = (v: number) => padTop + (1 - (v - min) / range) * (height - padTop - padBottom);
  const points = rounds.map((r, i) => `${x(i)},${y(r.relativeScore)}`).join(" ");
  const parY = y(0);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full">
      <line x1={padX} y1={parY} x2={width - padX} y2={parY} stroke="var(--line-strong)" strokeWidth="1" strokeDasharray="4 3" />
      <polyline points={points} fill="none" stroke="var(--positive)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      {rounds.map((r, i) => {
        const py = y(r.relativeScore);
        const labelAbove = py - padTop > 14;
        return (
          <g key={r.weekNumber}>
            <circle cx={x(i)} cy={py} r="3" fill="var(--positive)" />
            <text
              x={x(i)}
              y={labelAbove ? py - 8 : py + 16}
              textAnchor="middle"
              className="font-[family-name:var(--font-mono)] text-[15px] lg:text-[11px]"
              fontWeight="600"
              fill={signInk(r.relativeScore)}
            >
              {toPar(r.relativeScore)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function ShotMixBar({ breakdown }: { breakdown: { birdieOrBetterRate: number; parRate: number; bogeyOrWorseRate: number } }) {
  return (
    <div>
      <div className="flex h-3 overflow-hidden rounded-[var(--r-chip)]" style={{ background: "var(--track)" }}>
        <div style={{ width: `${breakdown.birdieOrBetterRate}%`, background: "var(--positive)" }} />
        <div style={{ width: `${breakdown.parRate}%`, background: "var(--neutral-bar)" }} />
        <div style={{ width: `${breakdown.bogeyOrWorseRate}%`, background: "var(--negative)" }} />
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-[family-name:var(--font-mono)] text-xs">
        <span style={{ color: "var(--positive)" }}>{breakdown.birdieOrBetterRate}% birdie+</span>
        <span style={{ color: "var(--ink-muted)" }}>{breakdown.parRate}% par</span>
        <span style={{ color: "var(--negative)" }}>{breakdown.bogeyOrWorseRate}% bogey+</span>
      </div>
    </div>
  );
}

function StackCard<T extends number>({
  label,
  mine,
  field,
  format,
  reading,
  lowerIsBetter,
}: {
  label: string;
  mine: T | null;
  field: T | null;
  format: (v: number) => string;
  reading: (mine: number, field: number) => string;
  lowerIsBetter?: boolean;
}) {
  const has = mine != null && field != null;
  const better = has ? (lowerIsBetter ? mine < field : mine > field) : false;
  return (
    <Card>
      <CardContent className="pt-6">
        <p className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[.13em]" style={{ color: "var(--ink-muted)" }}>
          {label}
        </p>
        <div className="mt-2 flex items-baseline gap-3">
          <span className="font-[family-name:var(--font-mono)] text-2xl font-semibold" style={{ color: has && better ? "var(--positive)" : "var(--ink)" }}>
            {mine != null ? format(mine) : "—"}
          </span>
          <span className="font-[family-name:var(--font-mono)] text-sm" style={{ color: "var(--ink-muted)" }}>
            vs {field != null ? format(field) : "—"}
          </span>
        </div>
        <p className="mt-2 text-xs" style={{ color: "var(--ink-3)" }}>
          {has ? reading(mine, field) : "Not enough data yet"}
        </p>
      </CardContent>
    </Card>
  );
}
