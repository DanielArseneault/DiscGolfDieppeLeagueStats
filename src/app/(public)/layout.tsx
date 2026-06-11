export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2 font-semibold text-slate-900">
            <span className="text-xl">🥏</span>
            <span>Dieppe DGC League</span>
          </a>
          <nav className="flex items-center gap-6 text-sm text-slate-600">
            <a href="/" className="hover:text-slate-900 transition-colors">Standings</a>
            <a href="/rounds" className="hover:text-slate-900 transition-colors">Rounds</a>
            <a href="/leagues" className="hover:text-slate-900 transition-colors">Leagues</a>
            <a href="/admin" className="hover:text-slate-900 transition-colors font-medium">Admin</a>
          </nav>
        </div>
      </header>
      <main className="flex-1 max-w-6xl mx-auto px-4 py-8 w-full">
        {children}
      </main>
      <footer className="border-t border-slate-200 bg-white mt-auto">
        <div className="max-w-6xl mx-auto px-4 py-6 text-center text-sm text-slate-500">
          ADG Dieppe Disc Golf Mixed Summer League · Sponsored by{" "}
          <span className="font-medium text-slate-700">Atlantic Disc Golf</span>
        </div>
      </footer>
    </>
  );
}
