export type HoleStat = {
  holeNumber: number;
  par: number;
  avg: number | null;
  differential: number | null;
  rank: number | null;
  eagles: number;
  birdies: number;
  birdiePercent: number | null;
  aces: number;
};

export function computeHoleStats(
  allHoleScores: Record<string, number>[],
  holePars: { holeNumber: number; par: number }[]
): HoleStat[] {
  const stats = holePars.map(({ holeNumber, par }) => {
    const scores = allHoleScores
      .map((hs) => hs[String(holeNumber)])
      .filter((s): s is number => typeof s === "number" && !isNaN(s));

    const avg = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
    const differential = avg != null ? avg - par : null;
    const eagles = scores.filter((s) => s <= par - 2).length;
    const birdies = scores.filter((s) => s === par - 1).length;
    const birdiePercent = scores.length > 0 ? Math.round((birdies / scores.length) * 100) : null;
    const aces = scores.filter((s) => s === 1).length;

    return { holeNumber, par, avg, differential, rank: null as number | null, eagles, birdies, birdiePercent, aces };
  });

  const sorted = [...stats]
    .filter((s) => s.differential != null)
    .sort((a, b) => a.differential! - b.differential!);
  const rankMap = new Map(sorted.map((s, i) => [s.holeNumber, i + 1]));

  return stats.map((s) => ({ ...s, rank: rankMap.get(s.holeNumber) ?? null }));
}
