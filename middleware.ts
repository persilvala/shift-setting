import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const AUTH_COOKIE = "demo-auth";
const publicPaths = ["/login"];
const protectedRoots = ["/dashboard", "/timesheets", "/payroll"];

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (pathname.startsWith("/_next") || pathname.startsWith("/api") || pathname === "/favicon.ico") {
    return NextResponse.next();
  }

  const hasAuth = Boolean(request.cookies.get(AUTH_COOKIE));
  const isPublic = publicPaths.some((path) => pathname === path || pathname.startsWith(`${path}/`));
  const isProtected = protectedRoots.some((path) => pathname === path || pathname.startsWith(`${path}/`));

  if (pathname === "/") {
    return NextResponse.redirect(new URL(hasAuth ? "/dashboard" : "/login", request.url));
  }

  if (isPublic) {
    return hasAuth ? NextResponse.redirect(new URL("/dashboard", request.url)) : NextResponse.next();
  }

  if (isProtected && !hasAuth) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname + (search || ""));
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
