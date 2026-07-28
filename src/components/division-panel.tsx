"use client";

import { useState } from "react";
import type { Division } from "@/generated/prisma/client";
import { StandingsTable } from "@/components/standings-table";
import { CourseStatsTable } from "@/components/course-stats-grid";
import { Card, CardContent } from "@/components/site-card";
import { toPar, signInk } from "@/lib/design-helpers";
import type { PlayerStanding } from "@/lib/standings";
import type { HoleStat } from "@/lib/course-stats";

/** Blue/Red division toggle for the standings + course-stats sections.
 *  Both divisions' data are already present in the initial page load, so switching
 *  is a client-side state flip — no server round-trip, no page reload. The URL still
 *  gets a `division=` param (via history.replaceState, not router navigation) so the
 *  view stays link-shareable. */
export function DivisionPanel({
  standings,
  bestScoresCount,
  qualifyingWeeks,
  minWeeks,
  leagueId,
  blueCount,
  redCount,
  blueStats,
  redStats,
  initialDivision,
  standingsTitle,
}: {
  standings: PlayerStanding[];
  bestScoresCount: number;
  qualifyingWeeks: number;
  minWeeks: number;
  leagueId: number;
  blueCount: number;
  redCount: number;
  blueStats: HoleStat[] | null;
  redStats: HoleStat[] | null;
  initialDivision: Division;
  standingsTitle: string;
}) {
  const [division, setDivision] = useState(initialDivision);

  const select = (d: Division) => {
    setDivision(d);
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("division", d === "BLUE" ? "blue" : "red");
      window.history.replaceState(null, "", url);
    } catch {}
  };

  const divisionCount = division === "BLUE" ? blueCount : redCount;
  const divisionStats = division === "BLUE" ? blueStats : redStats;

  return (
    <>
      <div
        className="mb-4 flex flex-wrap items-center gap-4 rounded-[var(--r-card)] border px-6 py-4"
        style={{ borderColor: "var(--line)", background: "var(--bg-card)" }}
      >
        <span className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[.14em]" style={{ color: "var(--ink-muted)" }}>
          Division
        </span>
        <div className="flex gap-2">
          <DivisionButton active={division === "BLUE"} label="Blue" disabled={blueCount === 0} onClick={() => select("BLUE")} />
          <DivisionButton active={division === "RED"} label="Red" disabled={redCount === 0} onClick={() => select("RED")} />
        </div>
        <p className="text-sm" style={{ color: "var(--ink-3)" }}>
          Standings and course stats below show the {division === "BLUE" ? "Blue" : "Red"} division · {divisionCount} players
        </p>
      </div>

      <SectionTitle>{standingsTitle}</SectionTitle>
      <Card>
        <CardContent className="pt-6">
          <p className="mb-4 text-xs" style={{ color: "var(--ink-muted)" }}>
            Best {bestScoresCount} of {qualifyingWeeks} qualifying rounds counted · Minimum {minWeeks} rounds to qualify
          </p>
          <StandingsTable standings={standings} division={division} bestScoresCount={bestScoresCount} leagueId={leagueId} />
        </CardContent>
      </Card>

      {divisionStats && (
        <div className="mt-8">
          <SectionTitle>Course stats</SectionTitle>
          <Card>
            <CardContent className="pt-6">
              <CourseStatsTable stats={divisionStats} />
              <CourseStatsCallouts stats={divisionStats} />
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-4 text-[20px] font-bold tracking-[-0.02em]" style={{ color: "var(--ink)" }}>
      {children}
    </h2>
  );
}

function DivisionButton({ active, label, disabled, onClick }: { active: boolean; label: string; disabled: boolean; onClick: () => void }) {
  if (disabled) return null;
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-10 items-center rounded-[var(--r-control)] px-4 text-sm font-medium transition-colors"
      style={
        active
          ? { background: label === "Blue" ? "var(--blue-solid)" : "var(--red-solid)", color: label === "Blue" ? "var(--blue-on)" : "var(--red-on)" }
          : { background: "var(--chip-neutral)", color: "var(--ink-2)" }
      }
    >
      {label}
    </button>
  );
}

function CourseStatsCallouts({ stats }: { stats: HoleStat[] }) {
  const ranked = stats.filter((s) => s.rank != null);
  const easiest = ranked.find((s) => s.rank === 1);
  const hardest = [...ranked].sort((a, b) => (b.rank ?? 0) - (a.rank ?? 0))[0];
  const totalEagles = stats.reduce((sum, s) => sum + s.eagles, 0);
  const totalAces = stats.reduce((sum, s) => sum + s.aces, 0);

  return (
    <div className="mt-6 grid gap-4 sm:grid-cols-3">
      <Callout
        label="Easiest hole"
        value={easiest ? `Hole ${easiest.holeNumber}` : "—"}
        detail={easiest?.differential != null ? toPar(Math.round(easiest.differential * 100) / 100) : undefined}
        ink={easiest?.differential != null ? signInk(easiest.differential) : undefined}
      />
      <Callout
        label="Hardest hole"
        value={hardest ? `Hole ${hardest.holeNumber}` : "—"}
        detail={hardest?.differential != null ? toPar(Math.round(hardest.differential * 100) / 100) : undefined}
        ink={hardest?.differential != null ? signInk(hardest.differential) : undefined}
      />
      <Callout label="Rare scores" value={`${totalEagles} eagles, ${totalAces} aces`} />
    </div>
  );
}

function Callout({ label, value, detail, ink }: { label: string; value: string; detail?: string; ink?: string }) {
  return (
    <div className="rounded-[var(--r-panel)] px-4 py-3" style={{ background: "var(--bg-inset)" }}>
      <p className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[.13em]" style={{ color: "var(--ink-muted)" }}>
        {label}
      </p>
      <p className="mt-1 text-[15px] font-semibold" style={{ color: "var(--ink)" }}>
        {value}
        {detail && (
          <span className="ml-2 font-[family-name:var(--font-mono)] text-sm font-normal" style={{ color: ink }}>
            {detail}
          </span>
        )}
      </p>
    </div>
  );
}
