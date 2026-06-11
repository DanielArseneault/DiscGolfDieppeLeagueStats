"use client";

import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface League {
  id: number;
  year: number;
  name: string;
}

function NavLinks({ leagues, onClose }: { leagues: League[]; onClose?: () => void }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const leagueParam = searchParams.get("league");
  const selected = leagues.find((l) => l.id === Number(leagueParam)) ?? leagues[0];
  const q = selected ? `?league=${selected.id}` : "";

  const navLink = (href: string, label: string) => {
    const active = pathname === href || (href !== "/" && pathname.startsWith(href));
    return (
      <a
        href={`${href}${q}`}
        onClick={onClose}
        className={`transition-colors ${active ? "text-white font-semibold underline underline-offset-4" : "text-green-100 hover:text-white"}`}
      >
        {label}
      </a>
    );
  };

  return (
    <>
      {navLink("/", "Standings")}
      {navLink("/rounds", "Rounds")}
      {leagues.length > 1 && selected && (
        <Select
          value={String(selected.id)}
          onValueChange={(value) => {
            onClose?.();
            router.push(`/?league=${value}`);
          }}
        >
          <SelectTrigger className="h-7 w-auto min-w-28 md:min-w-36 text-xs bg-white text-slate-800 border-transparent hover:bg-slate-100">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {leagues.map((league) => (
              <SelectItem key={league.id} value={String(league.id)}>
                {league.year} — {league.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      <a href="/admin" onClick={onClose} className="hover:text-white transition-colors font-medium text-green-200">
        Admin
      </a>
    </>
  );
}

function NavLinksFallback() {
  return (
    <>
      <a href="/" className="hover:text-white transition-colors">Standings</a>
      <a href="/rounds" className="hover:text-white transition-colors">Rounds</a>
      <a href="/admin" className="hover:text-white transition-colors font-medium text-green-200">Admin</a>
    </>
  );
}

export function PublicHeader({ leagues }: { leagues: League[] }) {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 80);
    handler();
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [menuOpen]);

  return (
    <header
      className={`fixed top-0 z-50 w-full transition-all duration-300 ${
        scrolled || menuOpen ? "bg-green-800 shadow-lg" : "bg-transparent"
      }`}
    >
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        <a href="/" className="flex items-center gap-2 font-bold text-white tracking-tight">
          <span className="text-xl">🥏</span>
          <span className="hidden sm:inline">Dieppe DGC League</span>
        </a>

        {/* Desktop nav */}
        <nav className="hidden sm:flex items-center gap-4 text-sm text-green-100">
          <Suspense fallback={<NavLinksFallback />}>
            <NavLinks leagues={leagues} />
          </Suspense>
        </nav>

        {/* Mobile hamburger */}
        <button
          className="sm:hidden text-white p-2 -mr-2 rounded-md hover:bg-white/10 transition-colors"
          onClick={() => setMenuOpen((o) => !o)}
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          aria-expanded={menuOpen}
        >
          {menuOpen ? (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )}
        </button>
      </div>

      {/* Mobile drawer */}
      {menuOpen && (
        <div className="sm:hidden border-t border-green-700 px-4 py-4">
          <nav className="flex flex-col gap-4 text-sm text-green-100">
            <Suspense fallback={<NavLinksFallback />}>
              <NavLinks leagues={leagues} onClose={() => setMenuOpen(false)} />
            </Suspense>
          </nav>
        </div>
      )}
    </header>
  );
}
