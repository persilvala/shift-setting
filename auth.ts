import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { authConfig } from "./auth.config";
import { prisma } from "./lib/db";
import bcrypt from "bcryptjs";

const SEVEN_DAYS = 7 * 24 * 60 * 60;

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) {
          return null;
        }

        const username = credentials.username as string;
        const password = credentials.password as string;

        const admin = await prisma.admin.findUnique({
          where: { username },
        });

        if (!admin) {
          return null;
        }

        const isValid = await bcrypt.compare(password, admin.passwordHash);

        if (!isValid) {
          return null;
        }

        return {
          id: admin.id,
          name: admin.username,
        };
      },
    }),
  ],
  session: {
    strategy: "jwt",
    maxAge: SEVEN_DAYS,
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
});
