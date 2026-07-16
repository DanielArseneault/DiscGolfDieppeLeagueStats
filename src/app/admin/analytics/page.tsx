import Link from "next/link";
import { getAnalyticsSummary, RANGE_OPTIONS, type RangeDays } from "@/lib/analytics";
import { PageViewsChart } from "@/components/admin/page-views-chart";
import { Card, CardContent } from "@/components/ui/card";

function StatTile({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent className="py-5">
        <div className="text-sm text-slate-500">{label}</div>
        <div className="text-3xl font-semibold text-slate-900 mt-1">{value.toLocaleString()}</div>
      </CardContent>
    </Card>
  );
}

function RangePicker({ active }: { active: RangeDays }) {
  return (
    <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5">
      {RANGE_OPTIONS.map((days) => (
        <Link
          key={days}
          href={days === 30 ? "/admin/analytics" : `/admin/analytics?days=${days}`}
          className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
            days === active ? "bg-slate-900 text-white" : "text-slate-500 hover:text-slate-900"
          }`}
        >
          {days} days
        </Link>
      ))}
    </div>
  );
}

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
        <h1 className="text-2xl font-bold text-slate-900">Site Analytics</h1>
        <RangePicker active={days} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatTile label="Total page views" value={summary.totalViews} />
        <StatTile label="Total unique visitors" value={summary.totalUniqueVisitors} />
        <StatTile label={`Views (last ${days} days)`} value={summary.rangeViews} />
        <StatTile label={`Unique visitors (last ${days} days)`} value={summary.rangeUniqueVisitors} />
      </div>

      <Card>
        <CardContent className="py-6">
          <h2 className="text-sm font-semibold text-slate-900 mb-4">Page views — last {days} days</h2>
          <PageViewsChart data={summary.dailyTrend} />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="py-6">
          <h2 className="text-sm font-semibold text-slate-900 mb-4">Top pages — last {days} days</h2>
          {summary.topPages.length === 0 ? (
            <p className="text-sm text-slate-500">No page views recorded yet.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {summary.topPages.map((page) => (
                <div key={page.path} className="flex items-center justify-between py-2 text-sm">
                  <span className="font-mono text-slate-700">{page.path}</span>
                  <span className="text-slate-500 tabular-nums">{page.views.toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
