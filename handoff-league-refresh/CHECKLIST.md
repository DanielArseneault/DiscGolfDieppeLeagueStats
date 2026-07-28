# Pre-ship checklist

## Tokens
- [ ] No raw hex outside `tokens.css` (grep `#[0-9a-fA-F]{6}` in components — expect zero)
- [ ] No `--tint-*-bg`, `--*-surface` or `--accent` in a `color:` position
- [ ] No `--*-fg` token in a `background:` position
- [ ] Every tint pair comes from the same family (`--tint-good-bg` + `--tint-good-fg`)
- [ ] Legend swatches use the same token as the cells they describe

## Contrast — check in BOTH themes
- [ ] No text lighter than `--ink-muted`
- [ ] Hero copy over the photo uses `--on-photo-*`, not theme ink
- [ ] Zero elements under 4.5:1. Script:
```js
const rgb = s => (s.match(/\d+/g)||[]).map(Number).slice(0,3);
const lum = c => { const a = c.map(v => { v/=255; return v<=.03928 ? v/12.92 : ((v+.055)/1.055)**2.4; });
  return .2126*a[0]+.7152*a[1]+.0722*a[2]; };
const ratio = (f,b) => { const [x,y]=[lum(rgb(f)),lum(rgb(b))]; return (Math.max(x,y)+.05)/(Math.min(x,y)+.05); };
[...document.querySelectorAll('span,a,button,td,th')].filter(el => {
  if (el.children.length || !el.textContent.trim()) return false;
  let p = el, bg = 'rgba(0, 0, 0, 0)';
  while (p && (bg === 'rgba(0, 0, 0, 0)' || bg === 'transparent')) { bg = getComputedStyle(p).backgroundColor; p = p.parentElement; }
  return ratio(getComputedStyle(el).color, bg) < 4.5;
});
```

## Layout
- [ ] 18-column grids use `minmax(0,1fr)`
- [ ] Table columns align across every row (one identical `gridTemplateColumns`, or one grid)
- [ ] No clipped or overflowing text at 1024px and 1280px:
```js
[...document.querySelectorAll('*')].filter(el => el.scrollWidth > el.clientWidth + 1 && el.clientWidth);
```
- [ ] Row heights even down each table
- [ ] Baseline-aligned control groups share an explicit height

## Data-driven encoding
- [ ] No hard-coded bar widths — every share computed from values
- [ ] Emphasis derived from the result, never pinned to one side
- [ ] Ties handled: equal scores render equally, with a neutral mark
- [ ] Missing rounds show an explicit state, never a zero or a blank
- [ ] Only the four counting rounds are filled chips
- [ ] Green means under par everywhere; clay means over par everywhere

## Content
- [ ] No emoji
- [ ] Optional awards (BoB tag, recap links, CTP) appear only when present
- [ ] Sample/placeholder data clearly labelled or removed
- [ ] Averages and deltas match the underlying scores
