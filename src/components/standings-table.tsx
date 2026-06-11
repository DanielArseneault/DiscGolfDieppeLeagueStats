"use client";

import { PlayerStanding } from "@/lib/standings";
import { Badge } from "@/components/ui/badge";
import { formatScore } from "@/lib/utils";
import { Division } from "@/generated/prisma/client";

interface StandingsTableProps {
  standings: PlayerStanding[];
  division: Division;
  bestScoresCount: number;
}

const POOL_COLORS: Record<string, "blue" | "green" | "red" | "yellow"> = {
  A: "blue",
  B: "green",
  C: "red",
  D: "yellow",
};

export function StandingsTable({ standings, division, bestScoresCount }: StandingsTableProps) {
  const filtered = standings.filter((s) => s.division === division);

  if (filtered.length === 0) {
    return <p className="text-slate-500 text-sm py-4">No results yet for this division.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left">
            <th className="pb-3 pr-4 font-medium text-slate-500 w-8">#</th>
            <th className="pb-3 pr-4 font-medium text-slate-500">Player</th>
            <th className="pb-3 pr-4 font-medium text-slate-500 text-center">Rounds</th>
            <th className="pb-3 pr-4 font-medium text-slate-500 text-center">
              Best {bestScoresCount}
            </th>
            <th className="pb-3 pr-4 font-medium text-slate-500 text-center">Scores</th>
            <th className="pb-3 font-medium text-slate-500 text-center">Pool</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((s) => (
            <tr
              key={s.playerId}
              className="border-b border-slate-100 hover:bg-slate-50 transition-colors"
            >
              <td className="py-3 pr-4 text-slate-400 font-mono text-xs">{s.rank}</td>
              <td className="py-3 pr-4">
                <span className="font-medium text-slate-900">{s.playerName}</span>
                {!s.qualified && (
                  <span className="ml-2 text-xs text-slate-400">(not yet qualified)</span>
                )}
              </td>
              <td className="py-3 pr-4 text-center tabular-nums text-slate-600">
                {s.roundsPlayed}
              </td>
              <td className="py-3 pr-4 text-center tabular-nums font-semibold text-slate-900">
                {s.qualified ? s.qualifyingTotal : "–"}
              </td>
              <td className="py-3 pr-4">
                <div className="flex gap-1 flex-wrap justify-center">
                  {s.allScores.map((score, i) => (
                    <span
                      key={i}
                      className={`text-xs px-1.5 py-0.5 rounded font-mono ${
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
