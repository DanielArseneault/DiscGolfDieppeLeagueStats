"use client";

import { useId, useState } from "react";
import type { DailyViews, RoundMarker, WeekdayViews } from "@/lib/analytics";

const VIEWS_COLOR = "#008300";
const VISITORS_COLOR = "#2a78d6";

function formatDateLabel(dateStr: string) {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function LegendKey({ color, label, line }: { color: string; label: string; line?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
      {line ? (
        <span className="inline-block w-4 rounded-full" style={{ height: 2, backgroundColor: color }} />
      ) : (
        <span className="inline-block size-2.5 rounded-[3px]" style={{ backgroundColor: color }} />
      )}
      {label}
    </span>
  );
}

export function PageViewsChart({
  data,
  markers = [],
}: {
  data: DailyViews[];
  markers?: RoundMarker[];
}) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const groupId = useId();
  const max = Math.max(1, ...data.map((d) => d.views));
  const active = activeIndex !== null ? data[activeIndex] : null;
  const markerByDate = new Map(markers.map((m) => [m.date, m.label]));
  const activeRound = active ? markerByDate.get(active.date) : undefined;

  const yPct = (v: number) => 100 - (v / max) * 100;
  const xPct = (i: number) => ((i + 0.5) / data.length) * 100;
  const linePoints = data.map((d, i) => `${xPct(i)},${yPct(d.visitors)}`).join(" ");

  return (
    <div className="viz-root relative">
      <div className="flex h-7 items-center justify-between gap-4">
        {active ? (
          <div className="pointer-events-none rounded-md border border-slate-200 bg-white px-2 py-1 text-xs shadow-sm">
            <span className="font-semibold text-slate-900">{active.views.toLocaleString()}</span>{" "}
            <span className="text-slate-500">views</span>{" "}
            <span className="font-semibold text-slate-900">{active.visitors.toLocaleString()}</span>{" "}
            <span className="text-slate-500">
              visitors · {formatDateLabel(active.date)}
              {activeRound && ` · ${activeRound} round`}
            </span>
          </div>
        ) : (
          <div />
        )}
        <div className="flex items-center gap-3 shrink-0">
          <LegendKey color={VIEWS_COLOR} label="Views" />
          <LegendKey color={VISITORS_COLOR} label="Unique visitors" line />
        </div>
      </div>

      <div className="relative mt-2">
        <div
          className="flex h-40 items-end gap-[2px] border-b border-slate-200"
          role="group"
          aria-label="Daily page views and unique visitors"
        >
          {data.map((d, i) => {
            const heightPct = (d.views / max) * 100;
            return (
              <button
                key={d.date}
                type="button"
                className="relative z-10 flex h-full flex-1 items-end justify-center"
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
                    backgroundColor: VIEWS_COLOR,
                    opacity: activeIndex === null || activeIndex === i ? 1 : 0.55,
                  }}
                />
                <span id={`${groupId}-${i}`} className="sr-only">
                  {d.views} views, {d.visitors} unique visitors on {formatDateLabel(d.date)}
                  {markerByDate.has(d.date) && ` (${markerByDate.get(d.date)} round)`}
                </span>
              </button>
            );
          })}
        </div>

        <svg
          className="pointer-events-none absolute inset-0 z-20 h-40 w-full"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <polyline
            points={linePoints}
            fill="none"
            stroke={VISITORS_COLOR}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>

        {active && (
          <span
            className="pointer-events-none absolute z-30 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-white"
            style={{
              left: `${xPct(activeIndex!)}%`,
              top: `${yPct(active.visitors)}%`,
              backgroundColor: VISITORS_COLOR,
            }}
          />
        )}
      </div>

      {markers.length > 0 && (
        <div className="flex gap-[2px]" aria-hidden="true">
          {data.map((d) => (
            <span key={d.date} className="flex h-3 flex-1 items-center justify-center">
              {markerByDate.has(d.date) && (
                <span className="text-[8px] leading-none text-slate-400" title={`${markerByDate.get(d.date)} round`}>
                  ▲
                </span>
              )}
            </span>
          ))}
        </div>
      )}

      <div className="relative mt-1 flex justify-between text-xs text-slate-400">
        <span>{formatDateLabel(data[0]?.date ?? "")}</span>
        <span>{formatDateLabel(data[data.length - 1]?.date ?? "")}</span>
        {markers.length > 0 && (
          <span className="absolute left-1/2 -translate-x-1/2">▲ = league round</span>
        )}
      </div>
    </div>
  );
}

export function WeekdayViewsChart({ data }: { data: WeekdayViews[] }) {
  const max = Math.max(1, ...data.map((d) => d.views));

  return (
    <div className="viz-root">
      <div className="flex h-32 items-end gap-3 border-b border-slate-200">
        {data.map((d) => {
          const heightPct = (d.views / max) * 100;
          return (
            <div key={d.weekday} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
              <span className="text-xs text-slate-700 tabular-nums">{d.views.toLocaleString()}</span>
              <span
                className="w-full max-w-[24px] rounded-t-[4px]"
                style={{
                  height: `${Math.max(heightPct * 0.82, d.views > 0 ? 3 : 0)}%`,
                  backgroundColor: VIEWS_COLOR,
                }}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-1 flex gap-3">
        {data.map((d) => (
          <span key={d.weekday} className="flex-1 text-center text-xs text-slate-400">
            {d.weekday}
          </span>
        ))}
      </div>
    </div>
  );
}
