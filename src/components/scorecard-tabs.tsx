"use client";

import { useState } from "react";

export function ScorecardTabs({
  blueContent,
  redContent,
  blueLabel = "Blue",
  redLabel = "Red",
}: {
  blueContent?: React.ReactNode;
  redContent?: React.ReactNode;
  blueLabel?: string;
  redLabel?: string;
}) {
  const [active, setActive] = useState<"blue" | "red">(blueContent ? "blue" : "red");

  if (!blueContent && !redContent) return null;
  if (!blueContent) return <>{redContent}</>;
  if (!redContent) return <>{blueContent}</>;

  return (
    <div>
      <div className="mb-4 flex gap-2">
        {(["blue", "red"] as const).map((div) => (
          <button
            key={div}
            type="button"
            onClick={() => setActive(div)}
            className="flex h-10 items-center rounded-[var(--r-control)] px-4 text-sm font-medium transition-colors"
            style={
              active === div
                ? {
                    background: div === "blue" ? "var(--blue-solid)" : "var(--red-solid)",
                    color: div === "blue" ? "var(--blue-on)" : "var(--red-on)",
                  }
                : { background: "var(--chip-neutral)", color: "var(--ink-2)" }
            }
          >
            {div === "blue" ? blueLabel : redLabel}
          </button>
        ))}
      </div>
      <div className="space-y-6">{active === "blue" ? blueContent : redContent}</div>
    </div>
  );
}
