import { prisma } from "@/lib/db";
import { PublicHeader } from "@/components/public-header";
import { TrackPageView } from "@/components/track-page-view";

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const leagues = await prisma.league.findMany({ orderBy: { year: "desc" } });

  return (
    <div className="site flex min-h-screen flex-col">
      <TrackPageView />
      <PublicHeader leagues={leagues} />
      <main className="mx-auto w-full max-w-[var(--container)] flex-1 px-8 pt-14 pb-8">
        {children}
      </main>
      <footer className="mt-auto" style={{ borderTop: "1px solid var(--line-2)", background: "var(--bg-subtle)" }}>
        <div
          className="mx-auto max-w-[var(--container)] px-8 py-6 text-center font-[family-name:var(--font-mono)] text-xs uppercase tracking-[.13em]"
          style={{ color: "var(--ink-muted)" }}
        >
          Dieppe Disc Golf Mixed Summer League
        </div>
      </footer>
    </div>
  );
}
