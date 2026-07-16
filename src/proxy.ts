import { auth } from "@/auth";
import { NextResponse } from "next/server";
import type { NextFetchEvent } from "next/server";

const VISITOR_COOKIE = "dgl_visitor";
const ONE_YEAR = 60 * 60 * 24 * 365;

export default auth((req, event: NextFetchEvent) => {
  const { pathname } = req.nextUrl;
  const isAdminRoute = pathname.startsWith("/admin");
  const isLoginPage = pathname === "/admin/login";

  if (isAdminRoute) {
    if (!isLoginPage && !req.auth) {
      return NextResponse.redirect(new URL("/admin/login", req.url));
    }
    if (isLoginPage && req.auth) {
      return NextResponse.redirect(new URL("/admin", req.url));
    }
    return NextResponse.next();
  }

  const response = NextResponse.next();

  const isPrefetch =
    req.headers.get("next-router-prefetch") || req.headers.get("purpose") === "prefetch";
  const isStaticAsset = /\.[a-zA-Z0-9]+$/.test(pathname);
  if (req.method === "GET" && !isPrefetch && !isStaticAsset) {
    let visitorId = req.cookies.get(VISITOR_COOKIE)?.value;
    if (!visitorId) {
      visitorId = crypto.randomUUID();
      response.cookies.set(VISITOR_COOKIE, visitorId, {
        maxAge: ONE_YEAR,
        httpOnly: true,
        sameSite: "lax",
        path: "/",
      });
    }

    event.waitUntil(
      fetch(new URL("/api/track", req.url), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ path: pathname, visitorId }),
      }).catch(() => {})
    );
  }

  return response;
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)"],
};
