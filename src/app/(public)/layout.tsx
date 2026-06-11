import { Suspense } from "react";
import { prisma } from "@/lib/db";
import { PublicHeader } from "@/components/public-header";

async function HeaderData() {
  const leagues = await prisma.league.findMany({ orderBy: { year: "desc" } });
  return <PublicHeader leagues={leagues} />;
}

function HeaderFallback() {
  return (
    <header className="fixed top-0 z-50 w-full bg-transparent">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        <a href="/" className="flex items-center gap-2 font-bold text-white tracking-tight">
          <span className="text-xl">🥏</span>
          <span className="hidden sm:inline">Dieppe DGC League</span>
        </a>
        <nav className="hidden sm:flex items-center gap-4 text-sm text-green-100">
          <a href="/" className="hover:text-white transition-colors">Standings</a>
          <a href="/rounds" className="hover:text-white transition-colors">Rounds</a>
          <a href="/admin" className="hover:text-white transition-colors font-medium text-green-200">Admin</a>
        </nav>
      </div>
    </header>
  );
}

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Suspense fallback={<HeaderFallback />}>
        <HeaderData />
      </Suspense>
      <main className="flex-1 max-w-6xl mx-auto px-4 pt-14 pb-8 w-full">
        {children}
      </main>
      <footer className="bg-green-800 border-t border-green-700 mt-auto">
        <div className="max-w-6xl mx-auto px-4 py-6 text-center text-sm text-green-200">
          ADG Dieppe Disc Golf Mixed Summer League · Sponsored by{" "}
          <span className="font-medium text-white">Atlantic Disc Golf</span>
        </div>
      </footer>
    </>
  );
}
