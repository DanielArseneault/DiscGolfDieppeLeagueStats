import Link from "next/link";
import type { PlayerStanding } from "@/lib/standings";
import type { Division } from "@/generated/prisma/client";
import { countingRounds, scoreChipStyle } from "@/lib/design-helpers";

interface StandingsTableProps {
  standings: PlayerStanding[];
  division: Division;
  bestScoresCount: number;
  leagueId: number;
}

const RANK_W = 56;
const PLAYER_W = 168;
const FROZEN_COLS = `${RANK_W}px ${PLAYER_W}px`;
const SCROLL_COLS = "90px 190px 80px 84px";
const HEADER_H = 32;
const ROW_H = 44;

const POOL_LABEL: Record<string, { variant: "pool-a" | "pool-b" }> = {
  A: { variant: "pool-a" },
  C: { variant: "pool-a" },
  B: { variant: "pool-b" },
  D: { variant: "pool-b" },
};

function RankChangeIndicator({ change }: { change: number | null }) {
  if (change === null)
    return (
      <span className="font-[family-name:var(--font-mono)] text-[10px]" style={{ color: "var(--ink-muted)" }}>
        new
      </span>
    );
  if (change === 0) return null;
  return (
    <span
      className="font-[family-name:var(--font-mono)] text-[11px] font-medium"
      style={{ color: change > 0 ? "var(--positive)" : "var(--negative)" }}
    >
      {change > 0 ? "↑" : "↓"}
      {Math.abs(change)}
    </span>
  );
}

export function StandingsTable({ standings, division, bestScoresCount, leagueId }: StandingsTableProps) {
  const filtered = standings.filter((s) => s.division === division);

  if (filtered.length === 0) {
    return (
      <p className="py-4 text-sm" style={{ color: "var(--ink-muted)" }}>
        No results yet for this division.
      </p>
    );
  }

  return (
    <div className="flex" style={{ borderTop: "1px solid var(--line-2)", background: "var(--bg-card)" }}>
      {/* Frozen: Rank / Player — plain flow, never scrolls. */}
      <div className="shrink-0" style={{ borderRight: "1px solid var(--line)" }}>
        <div
          className="grid items-center px-3 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[.13em]"
          style={{ gridTemplateColumns: FROZEN_COLS, height: HEADER_H, background: "var(--bg-subtle)", color: "var(--ink-muted)" }}
        >
          <div>#</div>
          <div className="pl-1">Player</div>
        </div>
        {filtered.map((s) => (
          <div
            key={s.playerId}
            className="grid items-center px-3"
            style={{
              gridTemplateColumns: FROZEN_COLS,
              height: ROW_H,
              background: "var(--bg-card)",
              borderTop: "1px solid var(--line-3)",
            }}
          >
            <div className="flex items-center gap-1.5">
              <span
                className="font-[family-name:var(--font-mono)] text-[15px]"
                style={{ color: "var(--ink-2)" }}
              >
                #{s.rank}
              </span>
              <RankChangeIndicator change={s.rankChange} />
            </div>
            <div className="min-w-0 pl-1">
              <Link
                href={`/players/${s.playerId}?league=${leagueId}`}
                className="block truncate text-[15px] leading-tight font-semibold"
                style={{ color: "var(--ink)" }}
              >
                {s.playerName}
              </Link>
              {!s.qualified && (
                <span className="block text-[10px] leading-tight" style={{ color: "var(--ink-muted)" }}>
                  not yet qualified
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Scrollable: Rounds / Best / Scores / Pool. */}
      <div className="min-w-0 flex-1 overflow-x-auto">
        <div style={{ minWidth: "444px" }}>
          <div
            className="grid px-3 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[.13em]"
            style={{ gridTemplateColumns: SCROLL_COLS, height: HEADER_H, background: "var(--bg-subtle)", color: "var(--ink-muted)" }}
          >
            <div className="text-center">Best {bestScoresCount}</div>
            <div>Scores</div>
            <div className="text-center">Rounds</div>
            <div className="text-center">Pool</div>
          </div>
          {filtered.map((s) => {
            const counting = countingRounds(s.allScores, bestScoresCount, bestScoresCount);
            const pool = s.championshipPool ? POOL_LABEL[s.championshipPool] : null;
            return (
              <div
                key={s.playerId}
                className="grid items-center px-3"
                style={{
                  gridTemplateColumns: SCROLL_COLS,
                  height: ROW_H,
                  background: "var(--bg-card)",
                  borderTop: "1px solid var(--line-3)",
                }}
              >
                <div className="text-center font-[family-name:var(--font-mono)] text-sm font-medium" style={{ color: "var(--ink)" }}>
                  {s.qualified ? s.qualifyingTotal : "–"}
                </div>
                <div className="flex flex-nowrap justify-start gap-1">
                  {s.allScores.map((score, i) => (
                    <span
                      key={i}
                      className="rounded-[var(--r-chip)] px-1.5 py-0.5 font-[family-name:var(--font-mono)] text-[11px] whitespace-nowrap"
                      style={scoreChipStyle(score, counting.has(i))}
                    >
                      {score}
                    </span>
                  ))}
                </div>
                <div className="text-center font-[family-name:var(--font-mono)] text-sm" style={{ color: "var(--ink-2)" }}>
                  {s.roundsPlayed}
                </div>
                <div className="text-center">
                  {pool ? (
                    <span
                      className="inline-flex items-center rounded-[var(--r-pill)] px-2.5 py-0.5 font-[family-name:var(--font-mono)] text-[11px]"
                      style={{ background: `var(--${pool.variant}-bg)`, color: `var(--${pool.variant}-fg)` }}
                    >
                      Pool {s.championshipPool}
                    </span>
                  ) : (
                    <span style={{ color: "var(--ink-muted)" }}>—</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
