"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "@/components/theme-toggle";

const links = [
  { href: "/admin", label: "Admin" },
  { href: "/admin/layouts", label: "Layouts" },
  { href: "/admin/analytics", label: "Analytics" },
];

function NavLinks({ onClose }: { onClose?: () => void }) {
  const pathname = usePathname();

  return (
    <>
      {links.map(({ href, label }) => {
        const active = pathname === href || (href !== "/admin" && pathname.startsWith(href));
        return (
          <Link
            key={href}
            href={href}
            onClick={onClose}
            className="nav-link text-[14px] shrink-0 transition-colors"
            style={{ color: active ? "var(--ink)" : "var(--ink-2)", fontWeight: active ? 600 : 400 }}
          >
            {label}
          </Link>
        );
      })}
    </>
  );
}

function Logo() {
  return (
    <Link href="/admin" className="nav-link flex shrink-0 items-center gap-2.5">
      <span
        className="flex h-[30px] w-[30px] items-center justify-center rounded-full"
        style={{ background: "var(--accent)" }}
      >
        <span className="h-[11px] w-[11px] rounded-full" style={{ border: "2px solid var(--accent-ink)" }} />
      </span>
      <span className="hidden text-[15px] font-extrabold tracking-tight sm:inline" style={{ color: "var(--ink)" }}>
        Dieppe DGC Admin
      </span>
    </Link>
  );
}

export function AdminNav() {
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
      className="sticky top-0 z-50 w-full backdrop-blur-[10px]"
      style={{ background: "var(--bg-nav)", borderBottom: "1px solid var(--line-2)" }}
    >
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <Logo />

        {/* Desktop nav */}
        <nav className="hidden items-center gap-6 sm:flex">
          <NavLinks />
          <span className="h-4 w-px" style={{ background: "var(--line-2)" }} />
          <Link href="/" className="nav-link text-[14px] transition-colors" style={{ color: "var(--ink-muted)" }}>
            ← Public Site
          </Link>
          <form action="/api/auth/signout" method="POST">
            <button
              type="submit"
              className="nav-link cursor-pointer text-[14px] transition-colors"
              style={{ color: "var(--ink-muted)" }}
            >
              Sign out
            </button>
          </form>
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
        <div className="px-4 py-4 sm:hidden" style={{ borderTop: "1px solid var(--line-2)" }}>
          <nav className="flex flex-col gap-4">
            <NavLinks onClose={() => setMenuOpen(false)} />
            <Link
              href="/"
              onClick={() => setMenuOpen(false)}
              className="nav-link text-[14px]"
              style={{ color: "var(--ink-muted)" }}
            >
              ← Public Site
            </Link>
            <form action="/api/auth/signout" method="POST">
              <button
                type="submit"
                className="nav-link cursor-pointer text-left text-[14px]"
                style={{ color: "var(--ink-muted)" }}
              >
                Sign out
              </button>
            </form>
          </nav>
          <div className="mt-4 pt-4" style={{ borderTop: "1px solid var(--line-2)" }}>
            <ThemeToggle variant="switch" />
          </div>
        </div>
      )}
    </header>
  );
}
