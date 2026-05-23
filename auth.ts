import { PrismaAdapter } from "@auth/prisma-adapter";
import { UserRole } from "@prisma/client";
import NextAuth from "next-auth";
import type { NextAuthConfig } from "next-auth";
import Apple from "next-auth/providers/apple";
import Google from "next-auth/providers/google";

import { prisma } from "@/lib/persistence/repositories";

const providers = [
  ...(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET
    ? [
        Google({
          clientId: process.env.AUTH_GOOGLE_ID,
          clientSecret: process.env.AUTH_GOOGLE_SECRET,
        }),
      ]
    : []),
  ...(process.env.AUTH_APPLE_ID && process.env.AUTH_APPLE_SECRET
    ? [
        Apple({
          clientId: process.env.AUTH_APPLE_ID,
          clientSecret: process.env.AUTH_APPLE_SECRET,
        }),
      ]
    : []),
];

const config = {
  adapter: PrismaAdapter(prisma),
  providers,
  session: { strategy: "database" },
  pages: {
    signIn: "/",
  },
  callbacks: {
    session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
        session.user.role = user.role ?? UserRole.publisher;
      }

      return session;
    },
  },
} satisfies NextAuthConfig;

export const { handlers, auth, signIn, signOut } = NextAuth(config);
