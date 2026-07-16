import { prisma } from "@/lib/db";

export const RANGE_OPTIONS = [7, 30, 90] as const;
export type RangeDays = (typeof RANGE_OPTIONS)[number];

export interface DailyViews {
  date: string; // YYYY-MM-DD
  views: number;
}

export interface TopPage {
  path: string;
  views: number;
}

export interface AnalyticsSummary {
  totalViews: number;
  totalUniqueVisitors: number;
  rangeViews: number;
  rangeUniqueVisitors: number;
  dailyTrend: DailyViews[];
  topPages: TopPage[];
}

export async function getAnalyticsSummary(days: RangeDays = 30): Promise<AnalyticsSummary> {
  const since = new Date();
  since.setDate(since.getDate() - (days - 1));
  since.setHours(0, 0, 0, 0);

  const [totalViews, totalVisitorGroups, rangeRows, topPageGroups] = await Promise.all([
    prisma.pageView.count(),
    prisma.pageView.groupBy({ by: ["visitorId"] }),
    prisma.pageView.findMany({
      where: { createdAt: { gte: since } },
      select: { path: true, visitorId: true, createdAt: true },
    }),
    prisma.pageView.groupBy({
      by: ["path"],
      where: { createdAt: { gte: since } },
      _count: { path: true },
      orderBy: { _count: { path: "desc" } },
      take: 10,
    }),
  ]);

  const dailyBuckets = new Map<string, number>();
  for (let i = 0; i < days; i++) {
    const d = new Date(since);
    d.setDate(d.getDate() + i);
    dailyBuckets.set(d.toISOString().slice(0, 10), 0);
  }

  const rangeVisitors = new Set<string>();
  for (const row of rangeRows) {
    rangeVisitors.add(row.visitorId);
    const key = row.createdAt.toISOString().slice(0, 10);
    dailyBuckets.set(key, (dailyBuckets.get(key) ?? 0) + 1);
  }

  return {
    totalViews,
    totalUniqueVisitors: totalVisitorGroups.length,
    rangeViews: rangeRows.length,
    rangeUniqueVisitors: rangeVisitors.size,
    dailyTrend: Array.from(dailyBuckets, ([date, views]) => ({ date, views })),
    topPages: topPageGroups.map((g) => ({ path: g.path, views: g._count.path })),
  };
}
