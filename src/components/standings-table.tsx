"use client";

import { useMemo } from "react";
import { PlayerStanding } from "@/lib/standings";
import { Badge } from "@/components/ui/badge";
import { formatScore } from "@/lib/utils";
import { Division } from "@/generated/prisma/client";
import Link from "next/link";

interface StandingsTableProps {
  standings: PlayerStanding[];
  division: Division;
  bestScoresCount: number;
  leagueId: number;
}

const POOL_COLORS: Record<string, "blue" | "green" | "red" | "yellow"> = {
  A: "blue",
  B: "green",
  C: "red",
  D: "yellow",
};

function RankChangeIndicator({ change }: { change: number | null }) {
  if (change === null) return <span className="text-xs text-slate-300 font-medium">new</span>;
  if (change === 0) return <span className="text-xs text-slate-300">—</span>;
  if (change > 0) return (
    <span className="text-xs font-semibold text-emerald-500 flex items-center gap-0.5">
      ↑{change}
    </span>
  );
  return (
    <span className="text-xs font-semibold text-red-400 flex items-center gap-0.5">
      ↓{Math.abs(change)}
    </span>
  );
}

export function StandingsTable({ standings, division, bestScoresCount, leagueId }: StandingsTableProps) {
  const filtered = useMemo(
    () => standings.filter((s) => s.division === division),
    [standings, division]
  );

  if (filtered.length === 0) {
    return <p className="text-slate-500 text-sm py-4">No results yet for this division.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left">
            <th className="sticky left-0 z-10 bg-white pb-3 pr-4 font-medium text-slate-500 w-10">#</th>
            <th className="sticky left-10 z-10 bg-white pb-3 pr-4 font-medium text-slate-500 border-r border-slate-200">Player</th>
            <th className="pb-3 pr-4 font-medium text-slate-500 text-center whitespace-nowrap">Rounds</th>
            <th className="pb-3 pr-4 font-medium text-slate-500 text-center whitespace-nowrap">
              Best {bestScoresCount}
            </th>
            <th className="pb-3 pr-4 font-medium text-slate-500 text-center whitespace-nowrap">Scores</th>
            <th className="pb-3 font-medium text-slate-500 text-center whitespace-nowrap">Pool</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((s) => (
            <tr
              key={s.playerId}
              className="group border-b border-slate-100 hover:bg-slate-50 transition-colors"
            >
              <td className="sticky left-0 z-10 bg-white group-hover:bg-slate-50 py-3 pr-4 transition-colors">
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-400 font-mono text-xs">{s.rank}</span>
                  <RankChangeIndicator change={s.rankChange} />
                </div>
              </td>
              <td className="sticky left-10 z-10 bg-white group-hover:bg-slate-50 py-3 pr-4 border-r border-slate-100 transition-colors">
                <Link
                  href={`/players/${s.playerId}?league=${leagueId}`}
                  className="font-medium text-slate-900 hover:text-blue-600 hover:underline transition-colors whitespace-nowrap"
                >
                  {s.playerName}
                </Link>
                {!s.qualified && (
                  <span className="ml-2 text-xs text-slate-400 hidden sm:inline">(not yet qualified)</span>
                )}
              </td>
              <td className="py-3 pr-4 text-center tabular-nums text-slate-600">
                {s.roundsPlayed}
              </td>
              <td className="py-3 pr-4 text-center tabular-nums font-semibold text-slate-900">
                {s.qualified ? s.qualifyingTotal : "–"}
              </td>
              <td className="py-3 pr-4">
                <div className="flex gap-1 flex-nowrap justify-center">
                  {s.allScores.map((score, i) => (
                    <span
                      key={i}
                      className={`text-xs px-1.5 py-0.5 rounded font-mono whitespace-nowrap ${
                        s.bestScores.includes(score) && s.bestScores.indexOf(score) !== -1
                          ? "bg-emerald-100 text-emerald-800 font-semibold"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {score}
                    </span>
                  ))}
                </div>
              </td>
              <td className="py-3 text-center">
                {s.championshipPool ? (
                  <Badge variant={POOL_COLORS[s.championshipPool] ?? "secondary"}>
                    Pool {s.championshipPool}
                  </Badge>
                ) : (
                  <span className="text-slate-300 text-xs">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
