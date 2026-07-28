/** Derived visual encodings for the league stats redesign.
 *  Every colour/length here is computed from data — see handoff-league-refresh/helpers.md. */

export type Tint = { bg: string; fg: string };

const pair = (name: string): Tint => ({
  bg: `var(--tint-${name}-bg)`,
  fg: `var(--tint-${name}-fg)`,
});

const EVEN_TINT: Tint = { bg: "var(--tint-even-bg)", fg: "var(--ink-2)" };

/** Average vs par → tint. Used by course stats and player hole tables. */
export function diffTint(diff: number): Tint {
  if (diff <= -0.7) return pair("best");
  if (diff < 0) return pair("good");
  if (diff <= 0.1) return EVEN_TINT;
  if (diff <= 0.8) return pair("warn");
  return pair("bad");
}

export interface StrokeMark {
  bg: string;
  fg: string;
  ring: string;
  weight: 400 | 500;
}

/** One hole, strokes relative to that hole's par → scorecard circle.
 *  Par returns no fill: the sparse-circle treatment is what gives the card life. */
export function strokeMark(strokes: number, par: number): StrokeMark {
  const rel = strokes - par;
  if (rel === 0) return { bg: "transparent", fg: "var(--ink-muted)", ring: "none", weight: 400 };
  if (rel <= -2) return { ...pair("best"), ring: "0 0 0 2px var(--ring-good)", weight: 500 };
  if (rel === -1) return { ...pair("good"), ring: "none", weight: 500 };
  if (rel === 1) return { ...pair("warn"), ring: "none", weight: 500 };
  return { ...pair("bad"), ring: "0 0 0 2px var(--ring-bad)", weight: 500 };
}

/** A whole round vs course par → standings score chip. */
export function roundChipTint(total: number, coursePar = 60): Tint {
  const d = total - coursePar;
  if (d <= -4) return pair("best");
  if (d < 0) return pair("good");
  if (d === 0) return EVEN_TINT;
  if (d <= 4) return pair("warn");
  return pair("bad");
}

/** Indices of the rounds that count toward the season total.
 *  Below the minimum nothing counts, so every chip renders outlined. */
export function countingRounds(scores: number[], take = 4, minimum = 4): Set<number> {
  if (scores.length < minimum) return new Set();
  return new Set(
    scores
      .map((v, i) => [v, i] as const)
      .sort((a, b) => a[0] - b[0])
      .slice(0, take)
      .map(([, i]) => i)
  );
}

export function scoreChipStyle(score: number, counting: boolean) {
  if (!counting) {
    return {
      background: "transparent",
      color: "var(--ink-muted)",
      border: "1px dashed var(--line-strong)",
    };
  }
  const { bg, fg } = roundChipTint(score);
  return { background: bg, color: fg, border: "1px solid transparent" };
}

export type H2hResult = "a" | "b" | "tie" | "none";

export function roundResult(a: number | null, b: number | null): H2hResult {
  if (a == null || b == null) return "none";
  return a < b ? "a" : b < a ? "b" : "tie";
}

const INK: Record<H2hResult, [string, string]> = {
  a: ["var(--ink)", "var(--ink-3)"],
  b: ["var(--ink-3)", "var(--ink)"],
  tie: ["var(--ink)", "var(--ink)"],
  none: ["var(--ink)", "var(--ink-muted)"],
};

const MARK: Record<H2hResult, [string, string]> = {
  a: ["←", "var(--a-ink)"],
  b: ["→", "var(--b-ink)"],
  tie: ["=", "var(--ink-muted)"],
  none: ["", "var(--ink-muted)"],
};

export function h2hRow(week: string, a: number | null, b: number | null) {
  const r = roundResult(a, b);
  return { week, result: r, aInk: INK[r][0], bInk: INK[r][1], mark: MARK[r][0], markInk: MARK[r][1] };
}

/** Tally shares divide by SHARED rounds, not decided ones, so ties stay visible
 *  as a neutral remainder and 0–0 renders fully neutral. */
export function tally(shared: { a: number; b: number }[]) {
  const aWins = shared.filter((r) => r.a < r.b).length;
  const bWins = shared.filter((r) => r.b < r.a).length;
  const n = shared.length || 1;
  const avg = (xs: number[]) => xs.reduce((t, x) => t + x, 0) / xs.length;
  return {
    aWins,
    bWins,
    played: shared.length,
    aBar: `${Math.round((aWins / n) * 100)}%`,
    bBar: `${Math.round((bWins / n) * 100)}%`,
    strokeDelta: shared.length
      ? Math.abs(avg(shared.map((r) => r.a)) - avg(shared.map((r) => r.b))).toFixed(1)
      : "0.0",
  };
}

/** U+2212 minus, not a hyphen — it aligns in mono and reads as a sign. */
export const toPar = (d: number) => (d === 0 ? "E" : (d > 0 ? "+" : "−") + Math.abs(d));

/** Averages keep two decimals in every table, so rows stay comparable. */
export const toParAvg = (d: number) => (d === 0 ? "E" : (d > 0 ? "+" : "−") + Math.abs(d).toFixed(2));

export const signInk = (d: number) => (d < 0 ? "var(--positive)" : d > 0 ? "var(--negative)" : "var(--ink-muted)");
