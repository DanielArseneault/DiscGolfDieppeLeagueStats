# Migration plan

Six ordered steps. Each is independently shippable.

## 1. Tokens and themes (do this first)
- Drop `tokens.css` into your global stylesheet, or translate it into your Tailwind theme
  (`theme.extend.colors`) keeping the exact same names.
- Wire the theme switch per `theme.md`: `data-theme="light"` on `<html>`, persisted in
  `localStorage` under `ddgc-theme`, applied by a blocking inline script before first paint.
- Load the two fonts (see README → Typography). Nothing else changes yet.

**Done when:** the existing site renders unchanged in dark, and toggling the attribute in
devtools flips every colour with no leftover hard-coded values.

## 2. Shell — nav, page container, card primitive
Build three primitives and use them everywhere:
- `<PageShell>` — sticky nav (logo, Standings / Rounds / Admin, theme toggle), `max-width`
  container, `gap` between cards.
- `<Card>` — `--bg-card`, `1px solid --line`, `border-radius: var(--r-card)`, `overflow:hidden`.
- `<CardHeader>` — title + mono caption left, controls right, bottom border `--line-2`.

## 3. Standings page
Hero (photo + fixed `--on-photo-*` ink) → stat strip → latest-week results → **one shared
division toggle** → standings table → course stats. See README → Screens → Standings.

## 4. Rounds index and round detail
The rounds index is a single table, not a card per week. The round detail scorecard uses
the sparse-circle treatment (par is plain text). Both described in README.

## 5. Player page
Hero with rank + form chips → stat strip → trend/shot-mix → transposed hole table →
"how he stacks up" cards → round history.

## 6. Compare page
Matchup header → derived head-to-head tally → value-pair comparison (no bars) → round-by-round.

## Data you will need to derive
None of this exists in the design files; compute it server-side:
- per player: scoring average, counting-round indices (four lowest), birdie/par/bogey rates,
  per-hole average + birdie count, nine splits, average weekly rank, wins, top-3 finishes
- per hole per division: field average vs par, birdie count and rate, difficulty rank
  (1 = easiest), eagle and ace counts
- per matchup: shared rounds, per-round result (a / b / tie), win counts, average stroke delta
