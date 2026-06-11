"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Player {
  playerId: number;
  playerName: string;
  division: string;
  qualifyingTotal: number;
  championshipPool: string | null;
  excludeFromChampionship: boolean;
  championshipPoolOverride: string | null;
}

const POOL_OPTIONS: Record<string, { label: string; value: string }[]> = {
  BLUE: [
    { label: "Auto", value: "auto" },
    { label: "Pool A", value: "A" },
    { label: "Pool B", value: "B" },
    { label: "Exclude", value: "exclude" },
  ],
  RED: [
    { label: "Auto", value: "auto" },
    { label: "Pool C", value: "C" },
    { label: "Pool D", value: "D" },
    { label: "Exclude", value: "exclude" },
  ],
};

export function PoolExclusions({ players }: { players: Player[] }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [loadingId, setLoadingId] = useState<number | null>(null);

  const blue = players.filter((p) => p.division === "BLUE");
  const red = players.filter((p) => p.division === "RED");

  async function handleChange(player: Player, value: string) {
    setLoadingId(player.playerId);
    const body =
      value === "exclude"
        ? { excludeFromChampionship: true, championshipPoolOverride: null }
        : { excludeFromChampionship: false, championshipPoolOverride: value === "auto" ? null : value };

    await fetch(`/api/players/${player.playerId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setLoadingId(null);
    startTransition(() => router.refresh());
  }

  function currentValue(player: Player): string {
    if (player.excludeFromChampionship) return "exclude";
    if (player.championshipPoolOverride) return player.championshipPoolOverride;
    return "auto";
  }

  return (
    <div className="space-y-4">
      <DivisionTable
        label="🔵 Blue Division"
        players={blue}
        onChange={handleChange}
        currentValue={currentValue}
        loadingId={loadingId}
      />
      <DivisionTable
        label="🔴 Red Division"
        players={red}
        onChange={handleChange}
        currentValue={currentValue}
        loadingId={loadingId}
      />
    </div>
  );
}

function DivisionTable({
  label,
  players,
  onChange,
  currentValue,
  loadingId,
}: {
  label: string;
  players: Player[];
  onChange: (p: Player, value: string) => void;
  currentValue: (p: Player) => string;
  loadingId: number | null;
}) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">{label}</p>
      <div className="rounded-md border border-slate-200 divide-y divide-slate-100">
        {players.map((p) => {
          const val = currentValue(p);
          const isExcluded = val === "exclude";
          const isOverridden = !isExcluded && p.championshipPoolOverride !== null;
          return (
            <div key={p.playerId} className={`flex items-center justify-between px-4 py-2.5 ${isExcluded ? "bg-slate-50" : ""}`}>
              <div className="flex items-center gap-3">
                <span className={`text-sm font-medium ${isExcluded ? "text-slate-400 line-through" : "text-slate-900"}`}>
                  {p.playerName}
                </span>
                <span className="text-xs text-slate-400 tabular-nums">{p.qualifyingTotal}</span>
                {isOverridden && (
                  <span className="text-xs text-amber-600 font-medium">overridden</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {!isExcluded && p.championshipPool && (
                  <span className="text-xs text-slate-400">
                    {isOverridden ? "→" : ""} Pool {p.championshipPool}
                  </span>
                )}
                <Select
                  value={val}
                  onValueChange={(v) => onChange(p, v)}
                  disabled={loadingId === p.playerId}
                >
                  <SelectTrigger className="h-7 w-32 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(POOL_OPTIONS[p.division] ?? []).map((opt) => (
                      <SelectItem key={opt.value} value={opt.value} className="text-xs">
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
