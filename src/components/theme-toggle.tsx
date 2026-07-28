"use client";

import { useEffect, useState } from "react";
import { toggleTheme, type Theme } from "@/lib/theme";

export function ThemeToggle({ variant = "icon" }: { variant?: "icon" | "switch" }) {
  // The switch only ever mounts client-side (inside the mobile drawer, which starts
  // closed), so it's safe to read the real theme immediately instead of guessing —
  // that avoids a visible jump each time the drawer opens. The icon variant is part
  // of the always-rendered desktop nav, so its first client render must match the
  // server-rendered markup; "light" is the server default when no theme cookie is set.
  const [theme, setTheme] = useState<Theme>(() => {
    if (variant === "switch" && typeof document !== "undefined") {
      return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
    }
    return "light";
  });

  useEffect(() => {
    setTheme(document.documentElement.dataset.theme === "dark" ? "dark" : "light");
  }, []);

  const isDark = theme === "dark";

  if (variant === "switch") {
    return (
      <button
        type="button"
        role="switch"
        aria-checked={isDark}
        onClick={() => setTheme(toggleTheme())}
        className="flex w-full items-center justify-between py-1"
      >
        <span className="text-[14px] font-medium" style={{ color: "var(--ink)" }}>
          {isDark ? "Dark mode" : "Light mode"}
        </span>
        <span
          className="relative inline-flex h-6 w-11 shrink-0 items-center rounded-[var(--r-pill)] border-2 transition-colors"
          style={{
            background: isDark ? "var(--accent)" : "var(--chip-neutral)",
            borderColor: isDark ? "var(--accent)" : "var(--ink-muted)",
          }}
        >
          <span
            className="inline-block h-[18px] w-[18px] rounded-full transition-transform"
            style={{
              background: isDark ? "var(--accent-ink)" : "var(--ink-2)",
              transform: isDark ? "translateX(19px)" : "translateX(3px)",
            }}
          />
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setTheme(toggleTheme())}
      aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-[var(--ink-muted)] transition-colors hover:border-[var(--accent-border)]"
    >
      {isDark ? (
        <span className="block h-2.5 w-2.5 rounded-full bg-[var(--ink-2)]" />
      ) : (
        <span className="block h-2.5 w-2.5 rounded-full border-2 border-[var(--ink-2)]" />
      )}
    </button>
  );
}
