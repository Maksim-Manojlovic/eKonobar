import { type NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider    from "next-auth/providers/google";
import FacebookProvider  from "next-auth/providers/facebook";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { compare } from "bcryptjs";
import { db, dbRaw } from "./db";
import { rateLimit } from "./rate-limit";
import type { Role, VerificationTier } from "@prisma/client";

const TTL_DEFAULT  = 24 * 60 * 60;      // 24 h — standard session
const TTL_REMEMBER =  7 * 24 * 60 * 60; // 7 d  — "zapamti me"

// In-process revocation cache — avoids a DB hit on every getServerSession() call.
// TTL of 60s means role changes propagate within one minute.
const _revCache = new Map<string, { revokedAt: number | null; cachedAt: number }>();
const REV_CACHE_TTL_MS = 60_000;

async function isTokenRevoked(userId: string, tokenIat: number): Promise<boolean> {
  const now = Date.now();
  const cached = _revCache.get(userId);
  if (cached && now - cached.cachedAt < REV_CACHE_TTL_MS) {
    return cached.revokedAt !== null && tokenIat < cached.revokedAt;
  }
  const row = await dbRaw.tokenRevocation.findUnique({ where: { userId }, select: { revokedAt: true } });
  _revCache.set(userId, {
    revokedAt: row ? row.revokedAt.getTime() / 1000 : null,
    cachedAt:  now,
  });
  // Evict stale entries to keep the map bounded to active users only
  for (const [key, entry] of _revCache) {
    if (now - entry.cachedAt >= REV_CACHE_TTL_MS) _revCache.delete(key);
  }
  return row !== null && tokenIat < row.revokedAt.getTime() / 1000;
}

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
    GoogleProvider({
      clientId:     process.env.GOOGLE_CLIENT_ID     ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    }),
    FacebookProvider({
      clientId:     process.env.FACEBOOK_CLIENT_ID     ?? "",
      clientSecret: process.env.FACEBOOK_CLIENT_SECRET ?? "",
    }),
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

        // IP guard — broad limit, stops distributed credential stuffing
        const rawIp = req?.headers?.["x-forwarded-for"];
        const ip = (Array.isArray(rawIp) ? rawIp[0] : rawIp?.split(",")[0])?.trim() ?? "unknown";
        const ipAllowed = await rateLimit(`login:ip:${ip}`, 20, 15 * 60 * 1000);
        if (!ipAllowed) {
          throw new Error("Previše pokušaja prijave. Sačekaj 15 minuta.");
        }

        // Per-email guard — tight limit, stops targeted brute-force
        const emailAllowed = await rateLimit(`login:email:${email}`, 5, 15 * 60 * 1000);
        if (!emailAllowed) {
          throw new Error("Previše neuspelih pokušaja prijave. Sačekaj 15 minuta.");
        }

        const user = await db.user.findUnique({ where: { email } });

        if (!user?.hashedPassword) return null;

        const valid = await compare(credentials.password, user.hashedPassword);
        if (!valid) return null;

        return {
          id:               user.id,
          email:            user.email,
          name:             user.name ?? undefined,
          role:             user.role,
          verificationTier: user.verificationTier,
          rememberMe:       credentials.rememberMe === "true",
          tourCompleted:    user.tourCompleted,
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
      // Client-side session.update({ role, ... }) — update token fields
      if (trigger === "update" && session) {
        if (session.role)             token.role             = session.role;
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
          token.id               = user.id;
          token.role             = user.role as Role;
          token.verificationTier = user.verificationTier as VerificationTier;
          token.tourCompleted    = user.tourCompleted;
          const ttl = user.rememberMe ? TTL_REMEMBER : TTL_DEFAULT;
          token.sessionExpiry = Math.floor(Date.now() / 1000) + ttl;
        } else {
          // OAuth: adapter provides basic user; fetch role/tier from DB
          const dbUser = await dbRaw.user.findUnique({
            where:  { id: user.id },
            select: { role: true, verificationTier: true, tourCompleted: true },
          });
          token.id               = user.id;
          token.role             = (dbUser?.role ?? "WAITER") as Role;
          token.verificationTier = (dbUser?.verificationTier ?? "UNVERIFIED") as VerificationTier;
          token.tourCompleted    = dbUser?.tourCompleted ?? false;
          token.sessionExpiry    = Math.floor(Date.now() / 1000) + TTL_DEFAULT;
        }
      }
      return token;
    },

    session({ session, token }) {
      session.user.id               = token.id as string;
      session.user.role             = token.role as Role;
      session.user.verificationTier = token.verificationTier as VerificationTier;
      session.user.tourCompleted    = token.tourCompleted;
      session.sessionExpiry         = token.sessionExpiry as number;
      return session;
    },
  },
};
