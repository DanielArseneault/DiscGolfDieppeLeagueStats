# Design reference — Dieppe League stats refresh

A visual refresh of the league stats site. Structure and information architecture are
**unchanged** — every section stays where it is. What changes is presentation: a real type
scale, a warm neutral palette with one green accent for "under par" and one clay accent for
"over par", small graphic devices that make dense number tables scannable, and a light/dark
theme switch.

Five pages: Standings (home), Rounds index, Round detail, Player detail, Compare.

## Fidelity
**High.** Colours, type sizes, weights, radii and spacing are final — match them. Copy is real
where it came from the live site and plausible fill elsewhere; use your real data.

---

## Design tokens
Full set with both themes in `tokens.css` / `tokens.json`. The names below are what the
components should reference.

### Surfaces
| token | dark | light | use |
|---|---|---|---|
| `--bg-app` | `#0e1310` | `#f4f3ed` | page background |
| `--bg-card` | `#141a16` | `#ffffff` | card surface |
| `--bg-subtle` | `#161d18` | `#fbfaf6` | table headers, banded rows, secondary podium rows |
| `--bg-inset` | `#111713` | `#f7f6f1` | inset panels (tally, CTP footer) |
| `--row-tint` | `#171f19` | `#fbfbf7` | highlighted row (top 3, latest week) |
| `--hero-a` | `#1b2620` | `#ffffff` | top of a hero gradient |
| `--bg-nav` | `rgba(14,19,16,.92)` | `rgba(251,250,246,.94)` | sticky nav, with `backdrop-filter: blur(10px)` |

### Ink — never lighter than `--ink-muted`
| token | dark | light |
|---|---|---|
| `--ink` | `#eef1e9` | `#1f2320` |
| `--ink-2` | `#c7d1c8` | `#3f3b31` |
| `--ink-3` | `#a9b7ac` | `#5f5a4e` |
| `--ink-muted` | `#93a397` | `#6f6a5c` |

### Lines
`--line` (card borders) · `--line-2` (section dividers) · `--line-3` (table row separators) ·
`--line-strong` (secondary buttons, dashed "dropped" chips) · `--accent-border` (active/hover edge).

### Semantic
| token | dark | light | use |
|---|---|---|---|
| `--accent` | `#c9f24d` | `#1f4d33` | **fills only** — logo, primary button, active pill |
| `--accent-ink` | `#141a16` | `#f4f2e7` | text on `--accent` |
| `--accent-soft` | `#1e2b22` | `#eef2ea` | active nav item, first-place row |
| `--chip-neutral` | `#23302a` | `#f1efe7` | inactive pill |
| `--positive` | `#c9f24d` | `#2c7a4b` | **ink** — links, under-par numbers, top-3 ranks |
| `--negative` | `#e2803f` | `#8a4517` | **ink** — over-par numbers, ↓ movement, hardest hole |
| `--blue-*` / `--red-*` | | | division ink / dot / surface / solid / on-solid |
| `--gold` | `#f0c04a` | `#8a6510` | ace mark, BoB tag mark |

> `--accent` is a *fill*. `--positive` is *ink*. They happen to be the same hex in dark, which
> is exactly why mixing them up stays invisible until you switch to light.

### Tint ramp (background + matching text, always as a pair)
| band | dark bg / fg | light bg / fg |
|---|---|---|
| `--tint-best-*` (eagle, ≤ −0.70) | `#c9f24d` / `#16200f` | `#cfe8c6` / `#1e5c33` |
| `--tint-good-*` (birdie, under par) | `#4c9e43` / `#0f1a10` | `#e4f0da` / `#25663a` |
| `--tint-even-*` (par) | `#26302a` / `--ink-2` | `#f0eee6` / `--ink-2` |
| `--tint-warn-*` (bogey, +0.10…+0.80) | `#4a3526` / `#f0cfae` | `#faeade` / `#8a4517` |
| `--tint-bad-*` (double+, > +0.80) | `#e2803f` / `#22140a` | `#f4dcc6` / `#8a4517` |

Ring colours for circled cells: `--ring-good`, `--ring-bad`.
Dropped score chip: `background: transparent; color: var(--ink-muted); border: 1px dashed var(--line-strong)`.

### Photo overlay — does NOT follow the theme
Anything layered on the hero photograph uses `--on-photo` (`#eef1e9`), `--on-photo-2`,
`--on-photo-muted` (`#a9b7ac`), `--on-photo-accent` (`#c9f24d`) and `--on-photo-scrim`,
all identical in both themes, because the scrim over the image stays dark. Using `--ink`
there makes the title invisible in light mode.

### Typography
```
Bricolage Grotesque — 400 / 600 / 800 (opsz 12..96)  → UI and display text
DM Mono — 400 / 500                                  → ALL numbers, labels, dates, metadata
```
The mono/sans split is the core rule: every numeric value, every uppercase micro-label, every
date is DM Mono; names, headings and sentences are Bricolage Grotesque. Numbers in mono is what
makes the tables line up and read as data.

| role | size | weight | tracking |
|---|---|---|---|
| page title | 42–52px | 800 | `-0.035em`, `line-height: .95–1` |
| section title | 20–22px | 700 | `-0.02em` |
| hero stat | 34–38px | 800 | `-0.03em`, `line-height: 1` |
| tally number | 56px | 800 | `-0.04em` |
| name (row) | 15–16px | 600 | — |
| name (winner) | 19–22px | 700 | `-0.02em` |
| body | 15–17px | 400 | `--ink-3` |
| mono label | 10px | 400 | `.13–.14em`, uppercase, `--ink-muted` |
| mono meta | 11–12px | 400 | `--ink-muted` |
| mono value | 10–19px | 400/500 | — |

`text-wrap: pretty` on multi-line headings and sentence copy.

### Geometry
Container `1120px` (`1180px` on round detail), page padding `32px`, card gap `24px`.
Card radius `24px`; inner panel `14px`; control `10px`; cell `6–8px`; pill `999px`.
Card header `padding: 22–24px 28px`; card body `26–32px`; table row `12–15px 28px`.
Stat strips are a 4-up grid with `gap: 1px` on a `--line` background — the gap *is* the divider.
Pills and buttons that sit on one baseline get an explicit `height: 40px` + `box-sizing: border-box`
so their tops align as well as their bottoms.
**No drop shadows anywhere.** Borders separate. Motion: colour transitions only (~140ms).

### Iconography — CSS shapes, no emoji
- **Logo** 30px circle `--accent` containing an 11px circle with `2px solid --accent-ink` (a disc).
- **Division dot** 8–9px circle, `--blue-dot` / `--red-dot`, 7px before the label.
- **Closest to pin** 11px circle, `2px solid --positive`, transparent fill (a target).
- **BoB tag** 11px square, `border-radius: 3px`, `2px solid --gold`.
- **Eagle** 7px square `transform: rotate(45deg)`; **Ace** 7px circle `--gold`.
- **Podium place** 24–26px circle: 1st `--accent` fill + `--accent-ink` mono numeral, 2nd
  transparent + `1px solid --line-strong`.
- **Theme toggle** filled dot = currently dark, ring = currently light.
- Arrows are text glyphs: `→ ← ↗ ↑ ↓ =`.

---

## Screens

### Standings (home) `/`
1. **Sticky nav** — logo, Standings / Rounds / Admin, theme toggle last.
2. **Hero** — a full-bleed course photo with a bottom-weighted dark scrim
   (`linear-gradient(to top, rgba(12,17,13,.96) 8%, rgba(12,17,13,.72) 42%, rgba(12,17,13,.28) 100%)`),
   copy in `--on-photo-*`. Title 52px/800. Bottom-left: "League info & registration →"
   (40px tall, translucent scrim background). Bottom-right on the same baseline: SEASON label +
   year pills. Below the photo, a 4-up stat strip: Blue count (blue dot), Red count (red dot),
   Qualified `29/68`, Rounds played `5/9`.
3. **Latest week results** — header with mono date + player count, "Full scorecard →" right.
   Two columns split by a 1px gap, one per division, each with podium rows
   (`26px | 1fr | auto`; first place on `--accent-soft` with a `--positive` numeral).
   Score reads `58 (−2)` — total in the sign colour, parenthetical muted. Show only the
   results that exist; do not pad.
4. **Division toggle — ONE control for the whole page.** Sits between cards: mono "DIVISION"
   label, Blue / Red buttons (active = division solid + on-solid ink, inactive =
   `--chip-neutral`), and a sentence stating what is shown ("Standings and course stats below
   show the Blue division · 24 players"). It drives the standings table, the course-stats
   table and the easiest/hardest callouts together, and is reflected in the URL.
5. **Season standings table** — `70px 1fr 80px 90px 190px 84px` = Rank / Player / Rounds /
   Best 4 / Scores / Pool. Header row mono uppercase on `--bg-subtle`.
   - Rank: `#N` 15px mono (`--positive` for top 3) + 11px movement arrow (`--positive` up,
     `--negative` down).
   - **Scores column is the key device:** one chip per round played; only the four *counting*
     rounds get a filled tint from the ramp, dropped rounds are dashed outlines. Under four
     rounds, every chip is outlined — nothing counts yet. This replaces explaining the rule.
   - Pool: a muted pill (Pool A warm-green, Pool B cool-slate — deliberately *not* the
     performance accents); unqualified players get a plain dash, so a pill always means
     "in a pool".
   - Top 3 rows on `--row-tint`.
6. **Course stats** — a transposed table, `80px repeat(18, minmax(0,1fr))`, `gap: 3px`, rows:
   Hole / Par / Avg / Diff / Rank / Birdies / Birdie % / Eagles / Aces. Par, Birdies and Eagles
   rows sit on `--bg-subtle` to band the table. Only the **Diff** row is tinted (ramp).
   Avg is tinted by sign at the same `diff > 0` threshold as Diff. Zero eagle/ace values stay
   `--ink-muted` (visible, not ghosted). Three callouts follow: easiest hole, hardest hole,
   rare scores — all derived, with the number in its sign colour.

### Rounds index `/rounds`
Header (breadcrumb, 48px title, "5 of 9 rounds played · dates · venue", award-mark legend,
season pills right), then **one table** — not a card per week:
`132px minmax(0,1.25fr) minmax(0,1.25fr) minmax(0,1.1fr) 116px`, `gap: 12px` =
Round / Blue winner / Red winner / Awards / actions.
- Round cell: week link (16px/600) over a mono line "July 20 · 40 players".
- Winner cells: name link that ellipsizes under pressure + non-shrinking score-to-par in
  `--positive`, prize on a mono line under.
- Awards: CTP always (target ring + name), BoB tag only on weeks that awarded one (gold square).
- Actions: "Recap ↗" **only when a recap URL exists**, then a "Card →" button.
- Latest week on `--row-tint`. Nothing after the last row — no "next round" placeholder.

All tracks must be fixed or zero-min `fr`. Content-sized (`auto`) tracks cannot align across
rows when each row is its own grid; if you build the table as one grid with `display:contents`
rows, move the row tint onto the cells.

### Round detail `/rounds/:id`
1. **Hero** — breadcrumb, 54px week title, date/venue/sponsor, prev/next week (the unavailable
   direction is a muted non-interactive chip). 4-up strip: Total players / Blue / Red / Low round.
2. **Three cards**, `minmax(0,1.2fr) minmax(0,1.2fr) minmax(0,1fr)` — Blue winners, Red winners,
   Awards. Winner rows use the podium circles; first place on `--accent-soft`. The awards card
   stacks CTP and BoB tag, the latter falling back to "Not awarded this week".
3. **Scorecard** — `38px 190px 62px 1fr`, last column `repeat(18, minmax(0,1fr))`, `gap: 3px`.
   Header shows hole number over par.
   **Sparse circles, not a tinted wall:** par is plain `--ink-muted` text with no fill; birdie is
   a filled `--tint-good` circle; eagle a `--tint-best` circle with a `--ring-good` ring; bogey a
   `--tint-warn` circle; double+ a `--tint-bad` circle with a `--ring-bad` ring. A good round then
   reads as a constellation of green. Legend in the header — each swatch must use the *same*
   token as the cell it describes.
   Total column: `58` with a small sign-coloured `−2`. Leader row on `--row-tint`.

### Player detail `/players/:id`
Same section order as the live page.
1. **Hero** — breadcrumb; 76px rounded avatar with initials (`--accent` on `--accent-ink`);
   42px name; division pill + pool pill + PDGA link + "Compare →" chip; right side a 64px
   `#1` in `--positive` over "IN DIVISION" and a Qualified pill. Below, a **form strip**:
   oldest → newest chips, each score-to-par over its week label, shaded by result — every label
   at full opacity (no `opacity` dimming; it fails contrast).
2. **4-up stat strip** — Best 4 rounds / Scoring avg / Best round / Top 3 finishes.
3. **Trend + shot mix** side by side: an SVG line of only the rounds actually played (never
   plot a DNP as zero), with a dashed par line; and a stacked shot-distribution bar
   (`--positive` / `--neutral-bar` / `--negative`) with the three percentages under it, plus the
   nine splits.
4. **Hole performance** — transposed table, `80px repeat(18, minmax(0,1fr))`: Hole / Par / Avg /
   Diff / Birdies / Rank, Diff tinted, two decimals throughout. Callouts: money hole, trouble
   hole, rare scores.
5. **How he stacks up** — four cards, each "his number vs. division number" plus a one-line
   plain-language reading. *Deliberately not bars* — the paired-bar version tested badly.
6. **Round history** — Round / note / Score / +/− / Standing, the +/− coloured by sign.
7. **Closest to pin** footer bar.

### Compare `/compare?a=&b=`
1. **Matchup header** — breadcrumb, league/sponsor line, then `minmax(0,1fr) 64px minmax(0,1fr)`:
   player A left, "VS", player B right-aligned. Each side: division pill, 36px name link,
   mono "N rounds · avg X".
2. **Head-to-head tally** on `--bg-inset` — two 56px counts either side of a share bar, and a
   derived sentence ("won all four shared rounds, averaging 3.8 strokes better per round").
   The bar has one fill per player over a neutral track, each divided by **shared** rounds, so a
   tie leaves a visible neutral remainder and 0–0 stays fully neutral.
3. **Side by side** — `minmax(0,1fr) 190px minmax(0,1fr)`, grouped under mono headings.
   Value pairs with the label centred; a single `--positive` dot marks the better number, and
   that is the *only* encoding. Neutral rows (Status, Rounds played) carry no dot. Text values
   drop to 13px so they fit a numeric column.
4. **Round by round** — `120px minmax(0,1fr) 56px minmax(0,1fr)`; the winner's score takes
   `--ink`, the loser's `--ink-3`, and the arrow points to the winner in that player's colour.
   **Ties**: both scores in `--ink` and a muted `=`. **Missing round**: em-dash + "did not card".
   Never pin the emphasis to player A.

---

## Interactions
- **Links** `--positive`, no underline at rest, underline on hover. Define `a` and `a:hover`
  globally — never leave browser defaults.
- **Hover** — week/row surfaces go to `--accent-soft` with an `--accent-border` edge. No
  transforms, no lifts.
- **Touch targets** ≥ 44px; row padding gets you there on mobile — verify.
- **Empty / partial states** are first-class: fewer than four rounds → all chips outlined and
  Best 4 shows a dash; future weeks → dashed, non-interactive; no recap → omit the button; no
  BoB → "Not awarded this week"; no eagles/aces → "0 eagles, 0 aces".
- **Responsive** — below ~900px the 4-up strips go 2-up and 2×2 panels stack. The 18-column
  tables scroll horizontally with the leading label column sticky; do not squeeze them.

## Files
| file | what |
|---|---|
| `CLAUDE.md` | rules for an assistant working in the repo |
| `MIGRATION.md` | ordered migration steps |
| `CHECKLIST.md` | pre-ship verification |
| `tokens.css` / `tokens.json` | both themes |
| `theme.md` | theme switching implementation |
| `helpers.md` | derived-value functions (ramps, counting rounds, head-to-head) |
| `reference/*.dc.html` | design references — open in a browser, **do not port** |
