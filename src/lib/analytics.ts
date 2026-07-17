import { prisma } from "@/lib/db";

export const RANGE_OPTIONS = [7, 30, 90] as const;
export type RangeDays = (typeof RANGE_OPTIONS)[number];

// Views are bucketed by day in the league's timezone, not UTC, so evening
// traffic (the interesting kind on league nights) lands on the right day.
const LEAGUE_TZ = "America/Moncton";

const dateKeyFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: LEAGUE_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const weekdayFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: LEAGUE_TZ,
  weekday: "short",
});

const WEEKDAY_ORDER = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export interface DailyViews {
  date: string; // YYYY-MM-DD in league time
  views: number;
  visitors: number;
}

export interface WeekdayViews {
  weekday: string; // "Mon" … "Sun"
  views: number;
}

export interface TopPage {
  path: string;
  label: string;
  views: number;
}

export interface TrafficSource {
  source: string; // referrer hostname or "direct"
  entries: number;
}

export interface SessionStats {
  visits: number;
  pagesPerVisit: number;
  singlePageShare: number; // 0–1
}

export interface DeviceSplit {
  device: "mobile" | "desktop";
  views: number;
}

export interface RoundMarker {
  date: string; // YYYY-MM-DD
  label: string; // "Week 4" / "Championship"
}

export interface RoundTraffic {
  label: string;
  date: string;
  views: number; // round day + following 2 days
}

export interface AnalyticsSummary {
  totalViews: number;
  totalUniqueVisitors: number;
  rangeViews: number;
  rangeUniqueVisitors: number;
  rangeNewVisitors: number;
  rangeReturningVisitors: number;
  sessions: SessionStats;
  devices: DeviceSplit[];
  dailyTrend: DailyViews[];
  weekdayTrend: WeekdayViews[];
  topPages: TopPage[];
  trafficSources: TrafficSource[];
  roundMarkers: RoundMarker[];
  roundTraffic: RoundTraffic[];
}

/** The last `days` day-keys (YYYY-MM-DD, league time), oldest first. */
function rangeDateKeys(days: number): string[] {
  const [y, m, d] = dateKeyFormat.format(new Date()).split("-").map(Number);
  const keys: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    keys.push(new Date(Date.UTC(y, m - 1, d - i)).toISOString().slice(0, 10));
  }
  return keys;
}

const STATIC_LABELS: Record<string, string> = {
  "/": "Home — standings",
  "/rounds": "Rounds list",
  "/compare": "Compare players",
};

async function resolvePageLabels(paths: string[]): Promise<Map<string, string>> {
  const playerIds: number[] = [];
  const roundIds: number[] = [];
  for (const path of paths) {
    const playerMatch = path.match(/^\/players\/(\d+)$/);
    if (playerMatch) playerIds.push(Number(playerMatch[1]));
    const roundMatch = path.match(/^\/rounds\/(\d+)$/);
    if (roundMatch) roundIds.push(Number(roundMatch[1]));
  }

  const [players, rounds] = await Promise.all([
    playerIds.length
      ? prisma.player.findMany({ where: { id: { in: playerIds } }, select: { id: true, name: true } })
      : [],
    roundIds.length
      ? prisma.round.findMany({
          where: { id: { in: roundIds } },
          select: { id: true, weekNumber: true, isChampionship: true },
        })
      : [],
  ]);

  const playerNames = new Map(players.map((p) => [p.id, p.name]));
  const roundLabels = new Map(
    rounds.map((r) => [r.id, r.isChampionship ? "Championship" : `Week ${r.weekNumber}`])
  );

  const labels = new Map<string, string>();
  for (const path of paths) {
    const playerMatch = path.match(/^\/players\/(\d+)$/);
    const roundMatch = path.match(/^\/rounds\/(\d+)$/);
    if (playerMatch) {
      const name = playerNames.get(Number(playerMatch[1]));
      labels.set(path, name ? `Player — ${name}` : path);
    } else if (roundMatch) {
      const label = roundLabels.get(Number(roundMatch[1]));
      labels.set(path, label ? `Round — ${label}` : path);
    } else {
      labels.set(path, STATIC_LABELS[path] ?? path);
    }
  }
  return labels;
}

export async function getAnalyticsSummary(days: RangeDays = 30): Promise<AnalyticsSummary> {
  const dateKeys = rangeDateKeys(days);
  const keySet = new Set(dateKeys);
  // Over-fetch by an hour past the earliest league-time midnight (UTC-2 is
  // ahead of both AST/ADT); exact membership is decided by day-key below.
  const sinceBuffer = new Date(`${dateKeys[0]}T00:00:00-02:00`);

  const [totalViews, visitorFirstSeen, fetchedRows, rangeRounds] = await Promise.all([
    prisma.pageView.count(),
    prisma.pageView.groupBy({ by: ["visitorId"], _min: { createdAt: true } }),
    prisma.pageView.findMany({
      where: { createdAt: { gte: sinceBuffer } },
      select: { path: true, visitorId: true, referrer: true, device: true, createdAt: true },
    }),
    prisma.round.findMany({
      where: { date: { gte: sinceBuffer } },
      select: { weekNumber: true, date: true, isChampionship: true },
      orderBy: { date: "asc" },
    }),
  ]);

  const rangeRows = fetchedRows
    .map((row) => ({ ...row, dateKey: dateKeyFormat.format(row.createdAt) }))
    .filter((row) => keySet.has(row.dateKey));

  const dailyViews = new Map<string, number>(dateKeys.map((k) => [k, 0]));
  const dailyVisitors = new Map<string, Set<string>>(dateKeys.map((k) => [k, new Set()]));
  const weekdayViews = new Map<string, number>(WEEKDAY_ORDER.map((w) => [w, 0]));
  const pathViews = new Map<string, number>();
  const sourceEntries = new Map<string, number>();
  const deviceViews = new Map<string, number>();
  const rangeVisitors = new Set<string>();

  for (const row of rangeRows) {
    dailyViews.set(row.dateKey, (dailyViews.get(row.dateKey) ?? 0) + 1);
    dailyVisitors.get(row.dateKey)?.add(row.visitorId);
    const weekday = weekdayFormat.format(row.createdAt);
    weekdayViews.set(weekday, (weekdayViews.get(weekday) ?? 0) + 1);
    pathViews.set(row.path, (pathViews.get(row.path) ?? 0) + 1);
    if (row.referrer) {
      sourceEntries.set(row.referrer, (sourceEntries.get(row.referrer) ?? 0) + 1);
    }
    if (row.device === "mobile" || row.device === "desktop") {
      deviceViews.set(row.device, (deviceViews.get(row.device) ?? 0) + 1);
    }
    rangeVisitors.add(row.visitorId);
  }

  // Sessions: a visitor's consecutive views with gaps under 30 minutes.
  const SESSION_GAP_MS = 30 * 60 * 1000;
  const byVisitor = new Map<string, number[]>();
  for (const row of rangeRows) {
    const times = byVisitor.get(row.visitorId);
    if (times) times.push(row.createdAt.getTime());
    else byVisitor.set(row.visitorId, [row.createdAt.getTime()]);
  }
  let visits = 0;
  let singlePageVisits = 0;
  for (const times of byVisitor.values()) {
    times.sort((a, b) => a - b);
    let sessionPages = 0;
    for (let i = 0; i < times.length; i++) {
      if (i === 0 || times[i] - times[i - 1] > SESSION_GAP_MS) {
        if (sessionPages === 1) singlePageVisits++;
        visits++;
        sessionPages = 0;
      }
      sessionPages++;
    }
    if (sessionPages === 1) singlePageVisits++;
  }

  // Rounds that fall inside the range, plus traffic on the round day + 2 days.
  const roundMarkers: RoundMarker[] = [];
  const roundTraffic: RoundTraffic[] = [];
  for (const round of rangeRounds) {
    const roundKey = round.date.toISOString().slice(0, 10);
    if (!keySet.has(roundKey)) continue;
    const label = round.isChampionship ? "Championship" : `Week ${round.weekNumber}`;
    roundMarkers.push({ date: roundKey, label });
    const [y, m, d] = roundKey.split("-").map(Number);
    let views = 0;
    for (let offset = 0; offset < 3; offset++) {
      const key = new Date(Date.UTC(y, m - 1, d + offset)).toISOString().slice(0, 10);
      views += dailyViews.get(key) ?? 0;
    }
    roundTraffic.push({ label, date: roundKey, views });
  }

  // A visitor is "new" if their first view ever falls inside the range.
  let rangeNewVisitors = 0;
  for (const group of visitorFirstSeen) {
    if (!rangeVisitors.has(group.visitorId)) continue;
    const firstSeen = group._min.createdAt;
    if (firstSeen && keySet.has(dateKeyFormat.format(firstSeen))) rangeNewVisitors++;
  }

  const topPagePaths = Array.from(pathViews.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
  const labels = await resolvePageLabels(topPagePaths.map(([path]) => path));

  return {
    totalViews,
    totalUniqueVisitors: visitorFirstSeen.length,
    rangeViews: rangeRows.length,
    rangeUniqueVisitors: rangeVisitors.size,
    rangeNewVisitors,
    rangeReturningVisitors: rangeVisitors.size - rangeNewVisitors,
    sessions: {
      visits,
      pagesPerVisit: visits > 0 ? rangeRows.length / visits : 0,
      singlePageShare: visits > 0 ? singlePageVisits / visits : 0,
    },
    devices: (["mobile", "desktop"] as const)
      .map((device) => ({ device, views: deviceViews.get(device) ?? 0 }))
      .filter((d) => d.views > 0),
    dailyTrend: dateKeys.map((date) => ({
      date,
      views: dailyViews.get(date) ?? 0,
      visitors: dailyVisitors.get(date)?.size ?? 0,
    })),
    weekdayTrend: WEEKDAY_ORDER.map((weekday) => ({
      weekday,
      views: weekdayViews.get(weekday) ?? 0,
    })),
    topPages: topPagePaths.map(([path, views]) => ({
      path,
      label: labels.get(path) ?? path,
      views,
    })),
    trafficSources: Array.from(sourceEntries.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([source, entries]) => ({ source, entries })),
    roundMarkers,
    roundTraffic,
  };
}
