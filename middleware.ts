import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_FILE = /\.(.*)$/;
const PUBLIC_PATHS = ["/login", "/favicon.ico", "/_next/image", "/_next/static"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isPublic =
    PUBLIC_PATHS.some((path) => pathname.startsWith(path)) || PUBLIC_FILE.test(pathname);

  if (isPublic) return NextResponse.next();

  const authed = request.cookies.get("demo-auth")?.value;

  if (!authed) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/((?!api).*)",
};
