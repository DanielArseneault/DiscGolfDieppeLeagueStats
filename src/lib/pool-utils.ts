// No Prisma imports — safe to use in both server and client components.

export type PoolPlacement = {
  playerName: string;
  score: number;
  relativeScore: number;
  prize?: string | null;
};

export type PoolSummary = {
  pool: string;
  first: PoolPlacement | null;
  second: PoolPlacement | null;
};

type ResultLike = {
  playerId: number;
  player: { name: string };
  score: number;
  relativeScore: number;
};

type StandingLike = {
  playerId: number;
  championshipPool: string | null;
};

export type PoolOverride = {
  pool: string;
  place: number;
  playerName: string;
  prize?: string | null;
};

export function computePoolSummaries(
  results: ResultLike[],
  standings: StandingLike[],
  savedOverrides: PoolOverride[]
): PoolSummary[] {
  const playerPoolMap = new Map<number, string>();
  for (const s of standings) {
    if (s.championshipPool) playerPoolMap.set(s.playerId, s.championshipPool);
  }

  // Group results by pool, sorted by relativeScore ascending
  const buckets = new Map<string, ResultLike[]>();
  for (const r of results) {
    const pool = playerPoolMap.get(r.playerId);
    if (!pool) continue;
    if (!buckets.has(pool)) buckets.set(pool, []);
    buckets.get(pool)!.push(r);
  }
  for (const [, items] of buckets) {
    items.sort((a, b) => a.relativeScore - b.relativeScore);
  }

  // Build override lookup: pool → (place → { playerName, prize })
  const overrideMap = new Map<string, Map<number, { playerName: string; prize?: string | null }>>();
  for (const ov of savedOverrides) {
    if (!overrideMap.has(ov.pool)) overrideMap.set(ov.pool, new Map());
    overrideMap.get(ov.pool)!.set(ov.place, { playerName: ov.playerName, prize: ov.prize });
  }

  return (["A", "B", "C", "D"] as const)
    .filter((pool) => buckets.has(pool))
    .map((pool) => {
      const items = buckets.get(pool)!;
      const poolOv = overrideMap.get(pool) ?? new Map<number, { playerName: string; prize?: string | null }>();

      const firstOv = poolOv.get(1);
      const firstItem = firstOv
        ? (items.find((r) => r.player.name === firstOv.playerName) ?? items[0])
        : items[0];

      const secondOv = poolOv.get(2);
      const secondItem = secondOv
        ? (items.find((r) => r.player.name === secondOv.playerName) ?? items.find((r) => r !== firstItem))
        : items.find((r) => r !== firstItem);

      const toPlacement = (r: ResultLike | undefined, ov?: { playerName: string; prize?: string | null }): PoolPlacement | null =>
        r ? { playerName: r.player.name, score: r.score, relativeScore: r.relativeScore, prize: ov?.prize } : null;

      return { pool, first: toPlacement(firstItem, firstOv), second: toPlacement(secondItem, secondOv) };
    });
}
