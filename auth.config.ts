import type { NextAuthConfig } from "next-auth";

export const authConfig = {
  pages: {
    signIn: "/login",
  },
  providers: [],
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isOnProtectedRoute =
        nextUrl.pathname.startsWith("/admin") &&
        nextUrl.pathname !== "/admin/password";

      if (isOnProtectedRoute) {
        if (isLoggedIn) return true;
        return false;
      } else if (isLoggedIn && nextUrl.pathname === "/login") {
        return Response.redirect(new URL("/admin/dashboard", nextUrl));
      }
      return true;
    },
  },
} satisfies NextAuthConfig;
