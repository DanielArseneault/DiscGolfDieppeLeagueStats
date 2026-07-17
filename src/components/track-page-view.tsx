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
    // The document referrer only describes how this page load was reached, so
    // send it with the first tracked view only; client-side navigations omit
    // the field entirely, which is how the API tells entries from navigations.
    const isEntry = lastTrackedPath === null;
    lastTrackedPath = pathname;

    const body = JSON.stringify(
      isEntry ? { path: pathname, referrer: document.referrer } : { path: pathname }
    );
    if (!navigator.sendBeacon?.("/api/track", body)) {
      fetch("/api/track", { method: "POST", body, keepalive: true }).catch(() => {});
    }
  }, [pathname]);

  return null;
}
