"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "@/components/theme-toggle";

const links = [
  { href: "/admin", label: "Admin" },
  { href: "/admin/layouts", label: "Layouts" },
  { href: "/admin/analytics", label: "Analytics" },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <div className="mx-auto flex h-12 max-w-6xl items-center justify-between px-4 text-sm">
      <div className="flex items-center gap-4 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        <span
          className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full"
          style={{ background: "var(--accent)" }}
        >
          <span className="h-[8px] w-[8px] rounded-full" style={{ border: "2px solid var(--accent-ink)" }} />
        </span>
        {links.map(({ href, label }) => {
          const active = pathname === href || (href !== "/admin" && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className="nav-link shrink-0 transition-colors"
              style={{ color: active ? "var(--ink)" : "var(--ink-2)", fontWeight: active ? 600 : 400 }}
            >
              {label}
            </Link>
          );
        })}
      </div>
      <div className="flex shrink-0 items-center gap-4">
        <ThemeToggle />
        <Link href="/" className="nav-link transition-colors" style={{ color: "var(--ink-muted)" }}>
          <span className="hidden sm:inline">← Public Site</span>
          <span className="sm:hidden">← Site</span>
        </Link>
        <form action="/api/auth/signout" method="POST">
          <button type="submit" className="nav-link cursor-pointer transition-colors" style={{ color: "var(--ink-muted)" }}>
            Sign out
          </button>
        </form>
      </div>
    </div>
  );
}
