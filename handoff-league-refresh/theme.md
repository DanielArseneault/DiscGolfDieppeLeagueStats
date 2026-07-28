# Theme switching

Two rules make this simple: the markup is identical in both themes, and every colour is a token.

## Markup
```html
<html lang="en">           <!-- dark is the default; light adds data-theme="light" -->
```

## Apply before first paint
A blocking inline script in `<head>`, before any stylesheet-dependent render, prevents a flash
of the wrong theme:

```html
<script>
  (function () {
    try {
      var t = localStorage.getItem("ddgc-theme");
      if (t === "light" || t === "dark") document.documentElement.dataset.theme = t;
    } catch (e) {}
  })();
</script>
```

In Next.js App Router put this in `app/layout.tsx` as a
`<script dangerouslySetInnerHTML={{ __html: ... }} />` inside `<head>`.

## Toggle
```ts
export function toggleTheme() {
  const current = document.documentElement.dataset.theme === "light" ? "light" : "dark";
  const next = current === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = next;
  try { localStorage.setItem("ddgc-theme", next); } catch {}
  return next;
}
```

The control lives last in the nav, shows the theme you would switch *to*, and uses a filled dot
for "currently dark" / a ring for "currently light".

## Optional: respect the system preference on first visit
```ts
const saved = localStorage.getItem("ddgc-theme");
const initial = saved ?? (matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark");
```

## Two traps
1. **Anything over the hero photograph must not follow the theme.** The scrim stays dark in both
   themes, so use `--on-photo`, `--on-photo-muted` and `--on-photo-accent` — identical in both
   blocks. Theme ink there is invisible in light mode.
2. **Do not tint the theme toggle itself with an accent.** It is chrome, not data.
