"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

// Module-level so React Strict Mode's double effect invocation in dev
// doesn't record the same pathname twice.
let lastTrackedPath: string | null = null;

export function TrackPageView() {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname === lastTrackedPath) return;
    lastTrackedPath = pathname;

    const body = JSON.stringify({ path: pathname });
    if (!navigator.sendBeacon?.("/api/track", body)) {
      fetch("/api/track", { method: "POST", body, keepalive: true }).catch(() => {});
    }
  }, [pathname]);

  return null;
}
