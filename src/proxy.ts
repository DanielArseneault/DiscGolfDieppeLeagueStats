import { auth } from "@/auth";
import { NextResponse } from "next/server";

const VISITOR_COOKIE = "dgl_visitor";
const ONE_YEAR = 60 * 60 * 24 * 365;

export default auth((req) => {
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

  // Page views are recorded client-side (see TrackPageView + /api/track);
  // the proxy only issues the visitor cookie the track API attributes views to.
  if (!req.cookies.get(VISITOR_COOKIE)?.value) {
    response.cookies.set(VISITOR_COOKIE, crypto.randomUUID(), {
      maxAge: ONE_YEAR,
      httpOnly: true,
      sameSite: "lax",
      path: "/",
    });
  }

  return response;
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)"],
};
