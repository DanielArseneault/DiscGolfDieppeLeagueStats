"use client";

import { useRouter } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface League {
  id: number;
  year: number;
  name: string;
}

interface LeagueSelectProps {
  leagues: League[];
  selectedLeagueId: number;
  basePath: string;
}

export function LeagueSelect({ leagues, selectedLeagueId, basePath }: LeagueSelectProps) {
  const router = useRouter();

  return (
    <Select
      value={String(selectedLeagueId)}
      onValueChange={(value) => router.push(`${basePath}?league=${value}`)}
    >
      <SelectTrigger className="w-auto min-w-40">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {leagues.map((league) => (
          <SelectItem key={league.id} value={String(league.id)}>
            {league.year} — {league.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
