"use client";

import { useState } from "react";
import { type HoleStat } from "@/lib/course-stats";

function diffClass(d: number | null) {
  if (d == null) return "";
  if (d <= -0.4) return "bg-emerald-100 text-emerald-800";
  if (d < 0) return "bg-emerald-50 text-emerald-700";
  if (d < 0.4) return "bg-red-50 text-orange-700";
  return "bg-red-100 text-red-800";
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      className={`w-4 h-4 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
      viewBox="0 0 20 20"
      fill="currentColor"
    >
      <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
    </svg>
  );
}

export function CourseStatsTable({ stats }: { stats: HoleStat[] }) {
  const rows: { label: string; render: (s: HoleStat) => React.ReactNode }[] = [
    { label: "Par", render: (s) => <span className="text-slate-500">{s.par}</span> },
    {
      label: "Avg",
      render: (s) =>
        s.avg != null ? (
          <span className={s.avg < s.par ? "text-emerald-600" : s.avg > s.par ? "text-orange-500" : "text-slate-500"}>
            {s.avg.toFixed(2)}
          </span>
        ) : <span className="text-slate-300">—</span>,
    },
    {
      label: "Diff.",
      render: (s) =>
        s.differential != null ? (
          <span className={`inline-block rounded px-1 font-medium ${diffClass(s.differential)}`}>
            {s.differential > 0 ? "+" : ""}{s.differential.toFixed(2)}
          </span>
        ) : <span className="text-slate-300">—</span>,
    },
    { label: "Rank", render: (s) => <span className="text-slate-600">{s.rank ?? "—"}</span> },
    { label: "Birdies", render: (s) => <span className="text-slate-800">{s.birdies}</span> },
    {
      label: "Birdie %",
      render: (s) =>
        s.birdiePercent != null ? (
          <span className="text-slate-600">{s.birdiePercent}%</span>
        ) : <span className="text-slate-300">—</span>,
    },
    {
      label: "Aces",
      render: (s) => <span className={s.aces > 0 ? "font-bold text-purple-600" : "text-slate-300"}>{s.aces}</span>,
    },
  ];

  return (
    <div className="overflow-x-auto rounded border border-slate-100">
      <table className="w-full text-center text-xs border-separate border-spacing-0">
        <thead>
          <tr className="bg-slate-50">
            <th className="text-left font-semibold text-slate-600 py-2 px-3 sticky left-0 bg-slate-50 border-b border-slate-100 min-w-[72px]">
              Hole
            </th>
            {stats.map((s) => (
              <th key={s.holeNumber} className="font-bold text-slate-700 py-2 px-2 border-b border-slate-100 min-w-[40px]">
                {s.holeNumber}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(({ label, render }, rowIdx) => (
            <tr key={label} className={rowIdx % 2 === 0 ? "bg-white" : "bg-slate-50/40"}>
              <td className={`text-left font-medium text-slate-500 py-1.5 px-3 sticky left-0 border-b border-slate-50 whitespace-nowrap ${rowIdx % 2 === 0 ? "bg-white" : "bg-slate-50"}`}>
                {label}
              </td>
              {stats.map((s) => (
                <td key={s.holeNumber} className="py-1.5 px-1.5 border-b border-slate-50">
                  {render(s)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function CourseStatsSection({ stats }: { stats: HoleStat[] }) {
  const [open, setOpen] = useState(true);

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-6 py-4 bg-white hover:bg-slate-50 transition-colors"
      >
        <span className="font-semibold text-slate-900 text-base">📊 Course Stats</span>
        <ChevronIcon open={open} />
      </button>
      {open && (
        <div className="px-6 pb-6 pt-4 border-t border-slate-100">
          <CourseStatsTable stats={stats} />
        </div>
      )}
    </div>
  );
}
