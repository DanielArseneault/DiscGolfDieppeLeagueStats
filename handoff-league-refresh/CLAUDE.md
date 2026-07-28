# Working in this repo — league stats visual refresh

You are migrating the Dieppe Disc Golf League stats site to a refreshed look.
Everything you need is in this folder. Read `MIGRATION.md` first, then `README.md`.

## Hard rules

1. **Do not port the `.dc.html` files.** They are design references that render standalone
   using inline styles and a custom template runtime. Recreate the designs with this repo's
   own patterns (components, Tailwind/CSS modules, data layer).
2. **Colour only through tokens.** Every colour comes from `tokens.css`. No raw hex in
   components. Both themes are defined there; the markup is identical in both.
3. **Never put a `--*-bg` / `--*-surface` token in a `color:` position, or a `--*-fg`
   token in a `background:` position.** Tint pairs must come from the same family
   (`--tint-good-bg` with `--tint-good-fg`). This was the single largest source of bugs
   during design — a mismatched pair reads fine in one theme and is invisible in the other.
4. **Derive every visual encoding from the data.** No hard-coded bar widths, no emphasis
   pinned to "player A". If a colour or length means "better", compute it from the values,
   and handle ties and missing rounds explicitly.
5. **No text lighter than `--ink-muted`.** That token is the 4.5:1 floor on every surface
   in both themes.
6. **No emoji.** Every mark is a CSS shape — see "Iconography" in `README.md`.
7. **18-column grids use `minmax(0,1fr)`,** never bare `1fr`, or wide values like `+1.24`
   break track alignment.

## Verify before you call it done
Run through `CHECKLIST.md`. The contrast and alignment items are not optional — they each
correspond to a real defect found in review.
