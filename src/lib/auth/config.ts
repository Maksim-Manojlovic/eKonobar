import "@/lib/core/env"; // validate required env vars at startup
import { type NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider    from "next-auth/providers/google";
import FacebookProvider  from "next-auth/providers/facebook";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { dbRaw } from "@/lib/core/db";
import type { Role, VerificationTier } from "@prisma/client";
import {
  TTL_REMEMBER,
  checkLoginRateLimit,
  verifyCredentials,
  buildJwtToken,
  buildSessionUser,
} from "./helpers";
import { isTokenRevoked } from "./revocation";

// ── authOptions ───────────────────────────────────────────────────────────────

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(dbRaw),
  session: { strategy: "jwt", maxAge: TTL_REMEMBER },
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore — trustHost is valid at runtime in Next.js 15 but not typed in next-auth v4
  trustHost: true,
  pages: {
    signIn:  "/login",
    newUser: "/onboarding/select-role",
  },
  providers: [
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [GoogleProvider({
          clientId:     process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        })]
      : []),
    ...(process.env.FACEBOOK_CLIENT_ID && process.env.FACEBOOK_CLIENT_SECRET
      ? [FacebookProvider({
          clientId:     process.env.FACEBOOK_CLIENT_ID,
          clientSecret: process.env.FACEBOOK_CLIENT_SECRET,
        })]
      : []),
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email:      { label: "Email",       type: "email" },
        password:   { label: "Lozinka",     type: "password" },
        rememberMe: { label: "Zapamti me",  type: "text" },
      },
      async authorize(credentials, req) {
        if (!credentials?.email || !credentials.password) return null;

        const email = credentials.email.toLowerCase();

        const rawIp = req?.headers?.["x-forwarded-for"];
        const ip = (Array.isArray(rawIp) ? rawIp[0] : rawIp?.split(",")[0])?.trim() ?? "unknown";

        await checkLoginRateLimit(ip, email); // throws on limit exceeded

        const user = await verifyCredentials(email, credentials.password);
        if (!user) return null;

        return {
          ...user,
          name:       user.name ?? undefined,
          rememberMe: credentials.rememberMe === "true",
        };
      },
    }),
  ],
  callbacks: {
    async signIn({ user }) {
      // Block sign-ins for soft-deleted accounts
      const dbUser = await dbRaw.user.findUnique({
        where:  { id: user.id },
        select: { deletedAt: true },
      });
      return !dbUser?.deletedAt;
    },

    async jwt({ token, user, account, trigger, session }) {
      // Client-side session.update({ role, ... })
      // Re-fetch role from DB — never trust the client-supplied value (privilege escalation guard).
      if (trigger === "update" && session) {
        if (session.role) {
          const dbUser = await dbRaw.user.findUnique({
            where:  { id: token.id as string },
            select: { role: true },
          });
          if (dbUser?.role) token.role = dbUser.role;
        }
        if (session.tourCompleted !== undefined) token.tourCompleted = session.tourCompleted;
        return token;
      }

      // Revocation check — skip on initial sign-in (user is set) since the token
      // hasn't been issued yet and there's nothing to revoke.
      if (!user && token.id && typeof token.iat === "number") {
        const revoked = await isTokenRevoked(token.id as string, token.iat);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (revoked) return null as any; // NextAuth clears the cookie on null at runtime
      }

      if (user) {
        if (account?.provider === "credentials") {
          // Credentials: authorize() already returned all needed fields
          const fields = buildJwtToken({
            id:               user.id,
            role:             user.role,
            verificationTier: user.verificationTier,
            tourCompleted:    user.tourCompleted,
            rememberMe:       user.rememberMe,
          });
          token.id               = fields.id;
          token.role             = fields.role;
          token.verificationTier = fields.verificationTier;
          token.tourCompleted    = fields.tourCompleted;
          token.sessionExpiry    = fields.sessionExpiry;
        } else {
          // OAuth: adapter provides basic user; fetch role/tier from DB
          const dbUser = await dbRaw.user.findUnique({
            where:  { id: user.id },
            select: { role: true, verificationTier: true, tourCompleted: true },
          });
          const fields = buildJwtToken({
            id:               user.id,
            role:             (dbUser?.role ?? "WAITER") as Role,
            verificationTier: (dbUser?.verificationTier ?? "UNVERIFIED") as VerificationTier,
            tourCompleted:    dbUser?.tourCompleted ?? false,
          }, true); // isOAuth = true → TTL_DEFAULT, ignores rememberMe
          token.id               = fields.id;
          token.role             = fields.role;
          token.verificationTier = fields.verificationTier;
          token.tourCompleted    = fields.tourCompleted;
          token.sessionExpiry    = fields.sessionExpiry;
        }
      }
      return token;
    },

    session({ session, token }) {
      const u = buildSessionUser(token);
      session.user.id               = u.id;
      session.user.role             = u.role;
      session.user.verificationTier = u.verificationTier;
      session.user.tourCompleted    = u.tourCompleted;
      session.sessionExpiry         = token.sessionExpiry;
      return session;
    },
  },
};
