import { type NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { db } from "./db";
import { rateLimit } from "./rate-limit";
import type { Role, VerificationTier } from "@prisma/client";

const TTL_DEFAULT  = 24 * 60 * 60;      // 24 h — standard session
const TTL_REMEMBER =  7 * 24 * 60 * 60; // 7 d  — "zapamti me"

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt", maxAge: TTL_REMEMBER },
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore — trustHost is valid at runtime in Next.js 15 but not typed in next-auth v4
  trustHost: true,
  pages: {
    signIn: "/login",
    newUser: "/onboarding/waiter",
  },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email:      { label: "Email",       type: "email" },
        password:   { label: "Lozinka",     type: "password" },
        rememberMe: { label: "Zapamti me",  type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials.password) return null;

        const email = credentials.email.toLowerCase();
        const allowed = await rateLimit(`login:${email}`, 5, 15 * 60 * 1000);
        if (!allowed) {
          throw new Error("Previše neuspelih pokušaja prijave. Sačekaj 15 minuta.");
        }

        const user = await db.user.findUnique({
          where: { email },
        });

        if (!user?.hashedPassword) return null;

        const valid = await compare(credentials.password, user.hashedPassword);
        if (!valid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name ?? undefined,
          role: user.role,
          verificationTier: user.verificationTier,
          rememberMe: credentials.rememberMe === "true",
          tourCompleted: user.tourCompleted,
        };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role as Role;
        token.verificationTier = user.verificationTier as VerificationTier;
        token.tourCompleted = user.tourCompleted;
        const ttl = user.rememberMe ? TTL_REMEMBER : TTL_DEFAULT;
        token.sessionExpiry = Math.floor(Date.now() / 1000) + ttl;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.id as string;
      session.user.role = token.role as Role;
      session.user.verificationTier = token.verificationTier as VerificationTier;
      session.user.tourCompleted = token.tourCompleted;
      // Izlažemo sessionExpiry klijentu za SessionExpiryToast.
      // Namerno NE overridujemo session.expires — to bi izazvalo
      // beskonačne re-fetch petlje u SessionProvider-u dok je JWT
      // envelope još uvek validan (7 dana).
      session.sessionExpiry = token.sessionExpiry as number;
      return session;
    },
  },
};
