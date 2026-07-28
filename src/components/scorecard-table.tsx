import Link from "next/link";
import { toPar, signInk, strokeMark } from "@/lib/design-helpers";

interface HolePar {
  holeNumber: number;
  par: number;
}

interface ResultRow {
  position: number;
  playerName: string;
  playerId?: number;
  score: number;
  relativeScore: number;
  holeScores: Record<string, number>;
}

interface ScorecardTableProps {
  results: ResultRow[];
  holePars: HolePar[];
  divisionLabel: string;
  leagueId: number;
}

const LEGEND: { label: string; strokes: number; par: number }[] = [
  { label: "Eagle", strokes: 1, par: 3 },
  { label: "Birdie", strokes: 2, par: 3 },
  { label: "Par", strokes: 3, par: 3 },
  { label: "Bogey", strokes: 4, par: 3 },
  { label: "Double+", strokes: 5, par: 3 },
];

const FROZEN_COLS = "38px 190px 62px";
const HOLE_COL_WIDTH = 38;
const HEADER_H = 40;
const ROW_H = 40;

export function ScorecardTable({ results, holePars, divisionLabel, leagueId }: ScorecardTableProps) {
  const holes = holePars.length > 0 ? holePars : Array.from({ length: 18 }, (_, i) => ({ holeNumber: i + 1, par: 3 }));

  const posCounts = results.reduce<Record<number, number>>((acc, r) => {
    acc[r.position] = (acc[r.position] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-[15px] font-semibold" style={{ color: "var(--ink)" }}>
          {divisionLabel}
        </h3>
        <div className="flex flex-wrap gap-3">
          {LEGEND.map((l) => {
            const mark = strokeMark(l.strokes, l.par);
            return (
              <span key={l.label} className="flex items-center gap-1.5 font-[family-name:var(--font-mono)] text-[10px]" style={{ color: "var(--ink-muted)" }}>
                <span
                  className="inline-flex h-4 w-4 items-center justify-center rounded-full"
                  style={{ background: mark.bg, boxShadow: mark.ring !== "none" ? mark.ring : undefined, border: mark.bg === "transparent" ? "1px solid var(--line-strong)" : undefined }}
                />
                {l.label}
              </span>
            );
          })}
        </div>
      </div>

      <div className="flex overflow-hidden rounded-[var(--r-card)] border" style={{ borderColor: "var(--line)", background: "var(--bg-card)" }}>
        {/* Frozen: Pos / Name / Total — plain flow, never scrolls, so nothing needs sticky positioning. */}
        <div className="shrink-0" style={{ borderRight: "1px solid var(--line)" }}>
          <div
            className="grid items-center px-2"
            style={{ gridTemplateColumns: FROZEN_COLS, gap: "3px", height: HEADER_H, background: "var(--bg-subtle)" }}
          >
            <div className="text-center font-[family-name:var(--font-mono)] text-[10px]" style={{ color: "var(--ink-muted)" }}>Pos</div>
            <div className="font-[family-name:var(--font-mono)] text-[10px]" style={{ color: "var(--ink-muted)" }}>Name</div>
            <div className="text-center font-[family-name:var(--font-mono)] text-[10px]" style={{ color: "var(--ink-muted)" }}>Total</div>
          </div>
          {results.map((r, idx) => (
            <div
              key={idx}
              className="grid items-center px-2"
              style={{
                gridTemplateColumns: FROZEN_COLS,
                gap: "3px",
                height: ROW_H,
                background: idx === 0 ? "var(--row-tint)" : "var(--bg-card)",
                borderTop: "1px solid var(--line-3)",
              }}
            >
              <div className="text-center font-[family-name:var(--font-mono)] text-xs" style={{ color: "var(--ink-2)" }}>
                {r.position === 0 ? "—" : posCounts[r.position] > 1 ? `T${r.position}` : r.position}
              </div>
              <div className="min-w-0">
                {r.playerId ? (
                  <Link href={`/players/${r.playerId}?league=${leagueId}`} className="block truncate text-sm font-semibold" style={{ color: "var(--ink)" }}>
                    {r.playerName}
                  </Link>
                ) : (
                  <div className="truncate text-sm font-semibold" style={{ color: "var(--ink)" }}>{r.playerName}</div>
                )}
              </div>
              <div className="text-center font-[family-name:var(--font-mono)] text-sm font-semibold" style={{ color: "var(--ink)" }}>
                {r.score}
                <span className="ml-1 text-[11px] font-normal" style={{ color: signInk(r.relativeScore) }}>
                  {toPar(r.relativeScore)}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Scrollable: hole-by-hole scores. */}
        <div className="min-w-0 flex-1 overflow-x-auto">
          <div style={{ minWidth: holes.length * HOLE_COL_WIDTH }}>
            <div
              className="grid items-center"
              style={{ gridTemplateColumns: `repeat(${holes.length}, ${HOLE_COL_WIDTH}px)`, height: HEADER_H, background: "var(--bg-subtle)" }}
            >
              {holes.map((h) => (
                <div key={h.holeNumber} className="text-center">
                  <div className="font-[family-name:var(--font-mono)] text-[11px]" style={{ color: "var(--ink-2)" }}>{h.holeNumber}</div>
                  <div className="font-[family-name:var(--font-mono)] text-[9px]" style={{ color: "var(--ink-muted)" }}>{h.par}</div>
                </div>
              ))}
            </div>
            {results.map((r, idx) => {
              const hs = r.holeScores;
              return (
                <div
                  key={idx}
                  className="grid items-center"
                  style={{
                    gridTemplateColumns: `repeat(${holes.length}, ${HOLE_COL_WIDTH}px)`,
                    height: ROW_H,
                    background: idx === 0 ? "var(--row-tint)" : "var(--bg-card)",
                    borderTop: "1px solid var(--line-3)",
                  }}
                >
                  {holes.map((h) => (
                    <div key={h.holeNumber} className="flex justify-center">
                      <HoleScore score={hs[String(h.holeNumber)]} par={h.par} />
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function HoleScore({ score, par }: { score: number | undefined; par: number }) {
  if (!score) return <span style={{ color: "var(--ink-muted)" }}>–</span>;
  const mark = strokeMark(score, par);
  if (mark.bg === "transparent") {
    return <span style={{ color: mark.fg }}>{score}</span>;
  }
  return (
    <span
      className="inline-flex h-6 w-6 items-center justify-center rounded-full text-[11px]"
      style={{ background: mark.bg, color: mark.fg, fontWeight: mark.weight, boxShadow: mark.ring !== "none" ? mark.ring : undefined }}
    >
      {score}
    </span>
  );
}
