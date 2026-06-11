"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

export function PublicHeader() {
  const pathname = usePathname();
  const isHome = pathname === "/";
  const [scrolled, setScrolled] = useState(!isHome);

  useEffect(() => {
    if (!isHome) {
      setScrolled(true);
      return;
    }
    const handler = () => setScrolled(window.scrollY > 80);
    handler();
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, [isHome]);

  return (
    <header
      className={`fixed top-0 z-50 w-full transition-all duration-300 ${
        scrolled ? "bg-teal-800 shadow-lg" : "bg-transparent"
      }`}
    >
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        <a href="/" className="flex items-center gap-2 font-bold text-white tracking-tight">
          <span className="text-xl">🥏</span>
          <span>Dieppe DGC League</span>
        </a>
        <nav className="flex items-center gap-6 text-sm text-teal-100">
          <a href="/" className="hover:text-white transition-colors">Standings</a>
          <a href="/rounds" className="hover:text-white transition-colors">Rounds</a>
          <a href="/leagues" className="hover:text-white transition-colors">Leagues</a>
          <a href="/admin" className="hover:text-white transition-colors font-medium text-teal-200">Admin</a>
        </nav>
      </div>
    </header>
  );
}
