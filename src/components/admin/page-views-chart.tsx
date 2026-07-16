"use client";

import { useId, useState } from "react";
import type { DailyViews } from "@/lib/analytics";

const BAR_COLOR = "#008300";

function formatDateLabel(dateStr: string) {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export function PageViewsChart({ data }: { data: DailyViews[] }) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const groupId = useId();
  const max = Math.max(1, ...data.map((d) => d.views));
  const active = activeIndex !== null ? data[activeIndex] : null;

  return (
    <div className="viz-root relative">
      {active && (
        <div className="pointer-events-none absolute -top-1 left-0 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs shadow-sm">
          <span className="font-semibold text-slate-900">{active.views.toLocaleString()}</span>{" "}
          <span className="text-slate-500">views · {formatDateLabel(active.date)}</span>
        </div>
      )}
      <div className="flex h-40 items-end gap-[2px] pt-6" role="group" aria-label="Page views for the last 30 days">
        {data.map((d, i) => {
          const heightPct = (d.views / max) * 100;
          return (
            <button
              key={d.date}
              type="button"
              className="group relative flex-1 h-full flex items-end justify-center"
              onMouseEnter={() => setActiveIndex(i)}
              onMouseLeave={() => setActiveIndex((cur) => (cur === i ? null : cur))}
              onFocus={() => setActiveIndex(i)}
              onBlur={() => setActiveIndex((cur) => (cur === i ? null : cur))}
              aria-describedby={`${groupId}-${i}`}
            >
              <span
                className="w-full max-w-[24px] rounded-t-[4px] transition-opacity"
                style={{
                  height: `${Math.max(heightPct, d.views > 0 ? 3 : 0)}%`,
                  backgroundColor: BAR_COLOR,
                  opacity: activeIndex === null || activeIndex === i ? 1 : 0.55,
                }}
              />
              <span id={`${groupId}-${i}`} className="sr-only">
                {d.views} views on {formatDateLabel(d.date)}
              </span>
            </button>
          );
        })}
      </div>
      <div className="mt-1 flex justify-between text-xs text-slate-400">
        <span>{formatDateLabel(data[0]?.date ?? "")}</span>
        <span>{formatDateLabel(data[data.length - 1]?.date ?? "")}</span>
      </div>
    </div>
  );
}
