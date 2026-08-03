"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Player {
  id: number;
  name: string;
  division: string;
  gender: string | null;
}

const GENDER_OPTIONS = [
  { label: "Unspecified", value: "unspecified" },
  { label: "Male", value: "MALE" },
  { label: "Female", value: "FEMALE" },
];

export function PlayerGenderEditor({ players }: { players: Player[] }) {
  const router = useRouter();
  const [loadingId, setLoadingId] = useState<number | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  function toggleSort() {
    setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
  }

  function sortByName(list: Player[]): Player[] {
    const sign = sortDir === "asc" ? 1 : -1;
    return [...list].sort((a, b) => sign * a.name.localeCompare(b.name));
  }

  const blue = sortByName(players.filter((p) => p.division === "BLUE"));
  const red = sortByName(players.filter((p) => p.division === "RED"));

  async function handleChange(player: Player, value: string) {
    setLoadingId(player.id);
    await fetch(`/api/players/${player.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gender: value === "unspecified" ? null : value }),
    });
    setLoadingId(null);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <button
        type="button"
        onClick={toggleSort}
        className="text-xs font-medium text-[var(--ink-muted)] hover:text-[var(--ink)] flex items-center gap-0.5"
      >
        Sort by name {sortDir === "asc" ? "▲" : "▼"}
      </button>
      <DivisionTable label="🔵 Blue Division" players={blue} onChange={handleChange} loadingId={loadingId} />
      <DivisionTable label="🔴 Red Division" players={red} onChange={handleChange} loadingId={loadingId} />
    </div>
  );
}

function DivisionTable({
  label,
  players,
  onChange,
  loadingId,
}: {
  label: string;
  players: Player[];
  onChange: (p: Player, value: string) => void;
  loadingId: number | null;
}) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--ink-muted)] mb-2">{label}</p>
      <div className="rounded-md border border-[var(--line)] divide-y divide-[var(--line-2)]">
        {players.map((p) => (
          <div key={p.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
            <span className="text-sm font-medium text-[var(--ink)] truncate min-w-0">{p.name}</span>
            <Select
              value={p.gender ?? "unspecified"}
              onValueChange={(v) => onChange(p, v)}
              disabled={loadingId === p.id}
            >
              <SelectTrigger className="h-7 w-32 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {GENDER_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value} className="text-xs">
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ))}
        {players.length === 0 && <p className="text-xs text-[var(--ink-muted)] px-4 py-3">No players yet.</p>}
      </div>
    </div>
  );
}
