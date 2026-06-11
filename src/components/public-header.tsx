"use client";

import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface League {
  id: number;
  year: number;
  name: string;
}

function NavContent({ leagues }: { leagues: League[] }) {
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
        className={`transition-colors ${active ? "text-white font-semibold underline underline-offset-4" : "text-green-100 hover:text-white"}`}
      >
        {label}
      </a>
    );
  };

  return (
    <nav className="flex items-center gap-4 text-sm text-green-100">
      {navLink("/", "Standings")}
      {navLink("/rounds", "Rounds")}
      {leagues.length > 1 && selected && (
        <Select
          value={String(selected.id)}
          onValueChange={(value) => router.push(`/?league=${value}`)}
        >
          <SelectTrigger className="h-7 w-auto min-w-36 text-xs bg-white text-slate-800 border-transparent hover:bg-slate-100">
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
      <a href="/admin" className="hover:text-white transition-colors font-medium text-green-200">Admin</a>
    </nav>
  );
}

function NavFallback() {
  return (
    <nav className="flex items-center gap-6 text-sm text-green-100">
      <a href="/" className="hover:text-white transition-colors">Standings</a>
      <a href="/rounds" className="hover:text-white transition-colors">Rounds</a>
      <a href="/admin" className="hover:text-white transition-colors font-medium text-green-200">Admin</a>
    </nav>
  );
}

export function PublicHeader({ leagues }: { leagues: League[] }) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 80);
    handler();
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  return (
    <header
      className={`fixed top-0 z-50 w-full transition-all duration-300 ${
        scrolled ? "bg-green-800 shadow-lg" : "bg-transparent"
      }`}
    >
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        <a href="/" className="flex items-center gap-2 font-bold text-white tracking-tight">
          <span className="text-xl">🥏</span>
          <span>Dieppe DGC League</span>
        </a>
        <Suspense fallback={<NavFallback />}>
          <NavContent leagues={leagues} />
        </Suspense>
      </div>
    </header>
  );
}
