import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "./auth.config";

const { auth } = NextAuth(authConfig);

const publicRoutes = ["/login", "/register", "/pending"];

function isRouteMatch(pathname: string, routes: string[]) {
  return routes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );
}

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isLoggedIn = Boolean(req.auth?.user);
  const isPublicRoute = isRouteMatch(pathname, publicRoutes);

  if (!isPublicRoute && !isLoggedIn) {
    const url = new URL("/login", req.nextUrl);
    url.searchParams.set("callbackUrl", req.nextUrl.href);
    return NextResponse.redirect(url);
  }

  if (isLoggedIn && pathname.startsWith("/login")) {
    const url = req.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  if (isPublicRoute) {
    return NextResponse.next();
  }

  const userAgent = req.headers.get("user-agent") || "";
  const isMobile =
    /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);

  if (
    isMobile &&
    !pathname.startsWith("/mobile") &&
    !pathname.startsWith("/api") &&
    !pathname.startsWith("/login") &&
    (pathname === "/" || pathname === "/dashboard")
  ) {
    const url = req.nextUrl.clone();
    url.pathname = "/mobile";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
