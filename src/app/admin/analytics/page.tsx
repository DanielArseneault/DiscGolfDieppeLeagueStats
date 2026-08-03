import Link from "next/link";
import { getAnalyticsSummary, RANGE_OPTIONS, type RangeDays } from "@/lib/analytics";
import { PageViewsChart, WeekdayViewsChart } from "@/components/admin/page-views-chart";
import { Card, CardContent } from "@/components/ui/card";

function StatTile({
  label,
  value,
  detail,
}: {
  label: string;
  value: number | string;
  detail?: string;
}) {
  return (
    <Card>
      <CardContent className="py-5">
        <div className="text-sm text-[var(--ink-muted)]">{label}</div>
        <div className="text-3xl font-semibold text-[var(--ink)] mt-1">
          {typeof value === "number" ? value.toLocaleString() : value}
        </div>
        {detail && <div className="text-xs text-[var(--ink-muted)] mt-1">{detail}</div>}
      </CardContent>
    </Card>
  );
}

const DEVICE_COLORS: Record<string, string> = { mobile: "#008300", desktop: "#2a78d6" };
const DEVICE_LABELS: Record<string, string> = { mobile: "Mobile", desktop: "Desktop" };

function DeviceSplitBar({ devices }: { devices: { device: string; views: number }[] }) {
  const total = devices.reduce((sum, d) => sum + d.views, 0);
  return (
    <div>
      <div className="flex h-4 gap-[2px] overflow-hidden rounded-[4px]">
        {devices.map((d) => (
          <div
            key={d.device}
            style={{
              width: `${(d.views / total) * 100}%`,
              backgroundColor: DEVICE_COLORS[d.device],
            }}
          />
        ))}
      </div>
      <div className="mt-3 space-y-1.5">
        {devices.map((d) => (
          <div key={d.device} className="flex items-center justify-between text-sm">
            <span className="inline-flex items-center gap-1.5 text-[var(--ink-2)]">
              <span
                className="inline-block size-2.5 rounded-[3px]"
                style={{ backgroundColor: DEVICE_COLORS[d.device] }}
              />
              {DEVICE_LABELS[d.device] ?? d.device}
            </span>
            <span className="text-[var(--ink-muted)] tabular-nums">
              {d.views.toLocaleString()} · {Math.round((d.views / total) * 100)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function formatRoundDate(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function RangePicker({ active }: { active: RangeDays }) {
  return (
    <div className="inline-flex rounded-lg border border-[var(--line)] bg-[var(--bg-card)] p-0.5">
      {RANGE_OPTIONS.map((days) => (
        <Link
          key={days}
          href={days === 30 ? "/admin/analytics" : `/admin/analytics?days=${days}`}
          className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
            days === active
              ? "bg-[var(--accent)] text-[var(--accent-ink)]"
              : "text-[var(--ink-muted)] hover:text-[var(--ink)]"
          }`}
        >
          {days} days
        </Link>
      ))}
    </div>
  );
}

const SOURCE_LABELS: Record<string, string> = {
  direct: "Direct / typed link",
  "m.facebook.com": "Facebook (mobile)",
  "l.facebook.com": "Facebook",
  "lm.facebook.com": "Facebook (mobile)",
  "www.facebook.com": "Facebook",
  "t.co": "X / Twitter",
  "www.google.com": "Google search",
  "www.bing.com": "Bing search",
  "duckduckgo.com": "DuckDuckGo search",
};

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  const { days: daysParam } = await searchParams;
  const parsed = Number(daysParam);
  const days: RangeDays = RANGE_OPTIONS.includes(parsed as RangeDays) ? (parsed as RangeDays) : 30;

  const summary = await getAnalyticsSummary(days);

  return (
    <div className="space-y-8 max-w-4xl">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h1 className="text-2xl font-bold text-[var(--ink)]">Site Analytics</h1>
        <RangePicker active={days} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatTile label="Total page views" value={summary.totalViews} />
        <StatTile label="Total unique visitors" value={summary.totalUniqueVisitors} />
        <StatTile label={`Views (last ${days} days)`} value={summary.rangeViews} />
        <StatTile
          label={`Unique visitors (last ${days} days)`}
          value={summary.rangeUniqueVisitors}
          detail={`${summary.rangeNewVisitors.toLocaleString()} new · ${summary.rangeReturningVisitors.toLocaleString()} returning`}
        />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <StatTile label={`Visits (last ${days} days)`} value={summary.sessions.visits} />
        <StatTile label="Pages per visit" value={summary.sessions.pagesPerVisit.toFixed(1)} />
        <StatTile
          label="One-page visits"
          value={`${Math.round(summary.sessions.singlePageShare * 100)}%`}
        />
      </div>

      <Card>
        <CardContent className="py-6">
          <h2 className="text-sm font-semibold text-[var(--ink)] mb-4">Page views — last {days} days</h2>
          <PageViewsChart data={summary.dailyTrend} markers={summary.roundMarkers} />
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-8">
        <Card>
          <CardContent className="py-6">
            <h2 className="text-sm font-semibold text-[var(--ink)] mb-4">
              Views by day of week — last {days} days
            </h2>
            <WeekdayViewsChart data={summary.weekdayTrend} />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="py-6">
            <h2 className="text-sm font-semibold text-[var(--ink)] mb-4">
              Traffic sources — last {days} days
            </h2>
            {summary.trafficSources.length === 0 ? (
              <p className="text-sm text-[var(--ink-muted)]">
                No entry visits recorded yet. Sources accumulate as visitors arrive from links.
              </p>
            ) : (
              <div className="divide-y divide-[var(--line-2)]">
                {summary.trafficSources.map((source) => (
                  <div key={source.source} className="flex items-center justify-between py-2 text-sm">
                    <span className="text-[var(--ink-2)]">
                      {SOURCE_LABELS[source.source] ?? source.source}
                    </span>
                    <span className="text-[var(--ink-muted)] tabular-nums">
                      {source.entries.toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        <Card>
          <CardContent className="py-6">
            <h2 className="text-sm font-semibold text-[var(--ink)] mb-4">
              Devices — last {days} days
            </h2>
            {summary.devices.length === 0 ? (
              <p className="text-sm text-[var(--ink-muted)]">
                No device data yet. It accumulates on new page views.
              </p>
            ) : (
              <DeviceSplitBar devices={summary.devices} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="py-6">
            <h2 className="text-sm font-semibold text-[var(--ink)] mb-4">
              Traffic around rounds — last {days} days
            </h2>
            {summary.roundTraffic.length === 0 ? (
              <p className="text-sm text-[var(--ink-muted)]">No rounds fall inside this range.</p>
            ) : (
              <div className="divide-y divide-[var(--line-2)]">
                {summary.roundTraffic.map((round) => (
                  <div key={round.date} className="flex items-center justify-between py-2 text-sm">
                    <span className="text-[var(--ink-2)]">
                      {round.label}{" "}
                      <span className="text-xs text-[var(--ink-muted)]">{formatRoundDate(round.date)}</span>
                    </span>
                    <span className="text-[var(--ink-muted)] tabular-nums">
                      {round.views.toLocaleString()} views in 3 days
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="py-6">
          <h2 className="text-sm font-semibold text-[var(--ink)] mb-4">Top pages — last {days} days</h2>
          {summary.topPages.length === 0 ? (
            <p className="text-sm text-[var(--ink-muted)]">No page views recorded yet.</p>
          ) : (
            <div className="divide-y divide-[var(--line-2)]">
              {summary.topPages.map((page) => (
                <div key={page.path} className="flex items-center justify-between gap-4 py-2 text-sm">
                  <div className="min-w-0">
                    <span className="text-[var(--ink-2)]">{page.label}</span>{" "}
                    <span className="font-mono text-xs text-[var(--ink-muted)]">{page.path}</span>
                  </div>
                  <span className="text-[var(--ink-muted)] tabular-nums shrink-0">
                    {page.views.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
