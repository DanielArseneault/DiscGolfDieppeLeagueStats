"use client";

import Link from "next/link";
import { useSearchParams, usePathname } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
import { ThemeToggle } from "@/components/theme-toggle";

interface League {
  id: number;
  year: number;
  name: string;
}

function NavLinks({ leagues, onClose }: { leagues: League[]; onClose?: () => void }) {
  const searchParams = useSearchParams();
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
        className="nav-link text-[14px] transition-colors"
        style={{
          color: active ? "var(--ink)" : "var(--ink-2)",
          fontWeight: active ? 600 : 400,
        }}
      >
        {label}
      </a>
    );
  };

  return (
    <>
      {navLink("/", "Standings")}
      {navLink("/rounds", "Rounds")}
      <a href="/admin" onClick={onClose} className="nav-link text-[14px]" style={{ color: "var(--ink-muted)" }}>
        Admin
      </a>
    </>
  );
}

function NavLinksFallback() {
  return (
    <>
      <a href="/" className="nav-link text-[14px]" style={{ color: "var(--ink-2)" }}>Standings</a>
      <a href="/rounds" className="nav-link text-[14px]" style={{ color: "var(--ink-2)" }}>Rounds</a>
      <a href="/admin" className="nav-link text-[14px]" style={{ color: "var(--ink-muted)" }}>Admin</a>
    </>
  );
}

function Logo() {
  return (
    <Link href="/" className="nav-link flex shrink-0 items-center gap-2.5">
      <span
        className="flex h-[30px] w-[30px] items-center justify-center rounded-full"
        style={{ background: "var(--accent)" }}
      >
        <span className="h-[11px] w-[11px] rounded-full" style={{ border: "2px solid var(--accent-ink)" }} />
      </span>
      <span className="hidden text-[15px] font-extrabold tracking-tight sm:inline" style={{ color: "var(--ink)" }}>
        Dieppe DGC League
      </span>
    </Link>
  );
}

export function PublicHeader({ leagues }: { leagues: League[] }) {
  const [menuOpen, setMenuOpen] = useState(false);

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
      className="fixed top-0 z-50 w-full backdrop-blur-[10px]"
      style={{ background: "var(--bg-nav)", borderBottom: "1px solid var(--line-2)" }}
    >
      <div className="mx-auto flex h-14 max-w-[var(--container)] items-center justify-between px-8">
        <Logo />

        {/* Desktop nav */}
        <nav className="hidden items-center gap-6 sm:flex">
          <Suspense fallback={<NavLinksFallback />}>
            <NavLinks leagues={leagues} />
          </Suspense>
          <ThemeToggle />
        </nav>

        {/* Mobile controls */}
        <div className="flex items-center gap-2 sm:hidden">
          <button
            className="flex h-10 w-10 items-center justify-center rounded-full transition-colors"
            style={{ color: "var(--ink)" }}
            onClick={() => setMenuOpen((o) => !o)}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
          >
            {menuOpen ? (
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      {menuOpen && (
        <div className="px-8 py-4 sm:hidden" style={{ borderTop: "1px solid var(--line-2)" }}>
          <nav className="flex flex-col gap-4">
            <Suspense fallback={<NavLinksFallback />}>
              <NavLinks leagues={leagues} onClose={() => setMenuOpen(false)} />
            </Suspense>
          </nav>
          <div className="mt-4 pt-4" style={{ borderTop: "1px solid var(--line-2)" }}>
            <ThemeToggle variant="switch" />
          </div>
        </div>
      )}
    </header>
  );
}
