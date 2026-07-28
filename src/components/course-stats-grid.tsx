"use client";

import { useState } from "react";
import { type HoleStat } from "@/lib/course-stats";
import { diffTint, toParAvg, signInk } from "@/lib/design-helpers";

function rankInk(rank: number | null, total: number) {
  if (rank == null) return "var(--ink-muted)";
  if (rank <= 3) return "var(--positive)";
  if (rank > total - 3) return "var(--negative)";
  return "var(--ink-muted)";
}

function countInk(n: number) {
  return n > 0 ? "var(--ink-2)" : "var(--ink-muted)";
}

const HOLE_COL_WIDTH = 46;

function GridRow({
  label,
  stats,
  banded,
  render,
}: {
  label: string;
  stats: HoleStat[];
  banded?: boolean;
  render: (s: HoleStat) => React.ReactNode;
}) {
  const rowBg = banded ? "var(--bg-subtle)" : "var(--bg-card)";
  return (
    <div
      className="grid items-center"
      style={{
        gridTemplateColumns: `80px repeat(${stats.length}, ${HOLE_COL_WIDTH}px)`,
        gap: "3px",
        background: rowBg,
      }}
    >
      <div
        className="sticky left-0 z-10 py-1.5 pl-1 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[.13em]"
        style={{
          color: "var(--ink-muted)",
          background: rowBg,
          borderRight: "1px solid var(--line)",
        }}
      >
        {label}
      </div>
      {stats.map((s) => (
        <div key={s.holeNumber} className="py-1.5 text-center font-[family-name:var(--font-mono)] text-[12px]">
          {render(s)}
        </div>
      ))}
    </div>
  );
}

export function CourseStatsTable({
  stats,
  fieldStats,
  variant = "full",
}: {
  stats: HoleStat[];
  fieldStats?: HoleStat[];
  variant?: "full" | "compact";
}) {
  const fieldByHole = new Map((fieldStats ?? []).map((s) => [s.holeNumber, s]));
  const n = stats.length;

  return (
    <div className="overflow-x-auto">
      <div style={{ minWidth: `${80 + n * HOLE_COL_WIDTH}px` }}>
        <GridRow label="Hole" stats={stats} render={(s) => <span style={{ color: "var(--ink)" }}>{s.holeNumber}</span>} />
        <GridRow
          label="Par"
          stats={stats}
          banded
          render={(s) => <span style={{ color: "var(--ink-2)" }}>{s.par}</span>}
        />
        <GridRow
          label="Avg"
          stats={stats}
          render={(s) =>
            s.avg != null ? (
              <span style={{ color: signInk(s.differential ?? 0) }}>{s.avg.toFixed(2)}</span>
            ) : (
              <span style={{ color: "var(--ink-muted)" }}>—</span>
            )
          }
        />
        <GridRow
          label="Diff"
          stats={stats}
          render={(s) => {
            if (s.differential == null) return <span style={{ color: "var(--ink-muted)" }}>—</span>;
            const tint = diffTint(s.differential);
            return (
              <span
                className="inline-block whitespace-nowrap rounded-[var(--r-chip)] px-1 py-0.5 text-[10px] font-medium"
                style={{ background: tint.bg, color: tint.fg }}
              >
                {toParAvg(s.differential)}
              </span>
            );
          }}
        />
        {variant === "full" && (
          <GridRow
            label="Rank"
            stats={stats}
            render={(s) => <span style={{ color: rankInk(s.rank, n) }}>{s.rank ?? "—"}</span>}
          />
        )}
        <GridRow
          label="Birdies"
          stats={stats}
          banded={variant === "full"}
          render={(s) => <span style={{ color: countInk(s.birdies) }}>{s.birdies}</span>}
        />
        {variant === "full" && (
          <GridRow
            label="Birdie %"
            stats={stats}
            render={(s) =>
              s.birdiePercent != null ? (
                <span style={{ color: "var(--ink-2)" }}>{s.birdiePercent}%</span>
              ) : (
                <span style={{ color: "var(--ink-muted)" }}>—</span>
              )
            }
          />
        )}
        {variant === "full" && (
          <>
            <GridRow
              label="Eagles"
              stats={stats}
              banded
              render={(s) => <span style={{ color: countInk(s.eagles) }}>{s.eagles}</span>}
            />
            <GridRow
              label="Aces"
              stats={stats}
              render={(s) => <span style={{ color: countInk(s.aces) }}>{s.aces}</span>}
            />
          </>
        )}
        {variant === "compact" && (
          <GridRow
            label="Rank"
            stats={stats}
            render={(s) => <span style={{ color: rankInk(s.rank, n) }}>{s.rank ?? "—"}</span>}
          />
        )}
        {fieldStats && (
          <>
            <GridRow
              label="Field avg"
              stats={stats}
              banded
              render={(s) => {
                const field = fieldByHole.get(s.holeNumber);
                return field?.avg != null ? (
                  <span style={{ color: "var(--ink-muted)" }}>{field.avg.toFixed(2)}</span>
                ) : (
                  <span style={{ color: "var(--ink-muted)" }}>—</span>
                );
              }}
            />
            <GridRow
              label="Vs. field"
              stats={stats}
              render={(s) => {
                const field = fieldByHole.get(s.holeNumber);
                if (s.avg == null || field?.avg == null) return <span style={{ color: "var(--ink-muted)" }}>—</span>;
                const diff = Math.round((s.avg - field.avg) * 100) / 100;
                const tint = diffTint(diff);
                return (
                  <span
                    className="inline-block whitespace-nowrap rounded-[var(--r-chip)] px-1 py-0.5 text-[10px] font-medium"
                    style={{ background: tint.bg, color: tint.fg }}
                  >
                    {toParAvg(diff)}
                  </span>
                );
              }}
            />
          </>
        )}
      </div>
    </div>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`}
      viewBox="0 0 20 20"
      fill="currentColor"
      style={{ color: "var(--ink-muted)" }}
    >
      <path
        fillRule="evenodd"
        d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export function CourseStatsSection({
  stats,
  fieldStats,
  variant = "full",
}: {
  stats: HoleStat[];
  fieldStats?: HoleStat[];
  variant?: "full" | "compact";
}) {
  const [open, setOpen] = useState(true);

  return (
    <div className="overflow-hidden rounded-[var(--r-card)] border" style={{ borderColor: "var(--line)" }}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-7 py-4 transition-colors"
        style={{ background: "var(--bg-card)" }}
      >
        <span className="text-[15px] font-semibold" style={{ color: "var(--ink)" }}>
          Course stats
        </span>
        <ChevronIcon open={open} />
      </button>
      {open && (
        <div className="px-7 pt-2 pb-6" style={{ borderTop: "1px solid var(--line-2)", background: "var(--bg-card)" }}>
          <CourseStatsTable stats={stats} fieldStats={fieldStats} variant={variant} />
        </div>
      )}
    </div>
  );
}
