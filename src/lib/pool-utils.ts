// No Prisma imports — safe to use in both server and client components.

export type PoolPlacement = {
  playerName: string;
  score: number;
  relativeScore: number;
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

  // Build override lookup: pool → (place → playerName)
  const overrideMap = new Map<string, Map<number, string>>();
  for (const ov of savedOverrides) {
    if (!overrideMap.has(ov.pool)) overrideMap.set(ov.pool, new Map());
    overrideMap.get(ov.pool)!.set(ov.place, ov.playerName);
  }

  return (["A", "B", "C", "D"] as const)
    .filter((pool) => buckets.has(pool))
    .map((pool) => {
      const items = buckets.get(pool)!;
      const poolOv = overrideMap.get(pool) ?? new Map<number, string>();

      const firstName = poolOv.get(1);
      const firstItem = firstName
        ? (items.find((r) => r.player.name === firstName) ?? items[0])
        : items[0];

      const secondName = poolOv.get(2);
      const secondItem = secondName
        ? (items.find((r) => r.player.name === secondName) ?? items.find((r) => r !== firstItem))
        : items.find((r) => r !== firstItem);

      const toPlacement = (r: ResultLike | undefined): PoolPlacement | null =>
        r ? { playerName: r.player.name, score: r.score, relativeScore: r.relativeScore } : null;

      return { pool, first: toPlacement(firstItem), second: toPlacement(secondItem) };
    });
}
