/**
 * Bearer-token session resolution for the native app.
 *
 * This is the single change that lets every existing route serve mobile clients:
 * the wrappers in `with-role.ts` try this first and fall back to the NextAuth
 * cookie, so no route handler needs editing.
 *
 * Deliberately isolated from `config.ts` (which pulls the whole NextAuth options
 * object, the Prisma adapter and every provider) so it stays unit-testable and
 * cheap to import — the same reasoning as `revocation.ts`.
 */

import { decode } from "next-auth/jwt";
import type { NextRequest } from "next/server";
import type { Session } from "next-auth";
import type { Role, VerificationTier } from "@prisma/client";
import logger from "@/lib/core/logger";
import { buildSessionUser } from "./helpers";
import { isTokenRevoked } from "./revocation";

const BEARER_PREFIX = "Bearer ";

/** Extracts the raw token from an Authorization header, or null when it is absent/malformed. */
export function readBearerToken(header: string | null): string | null {
  if (!header?.startsWith(BEARER_PREFIX)) return null;
  const token = header.slice(BEARER_PREFIX.length).trim();
  return token.length > 0 ? token : null;
}

/**
 * Resolves a `Session` from an Authorization: Bearer header.
 *
 * Returns null for anything that is not a valid, unexpired, unrevoked access
 * token — the caller then falls through to the cookie path and ultimately to 401.
 * A malformed token is a normal condition (an expired app session, a probe), so
 * it is not an error; decode failures are logged at debug level only.
 */
export async function getBearerSession(req: NextRequest): Promise<Session | null> {
  const raw = readBearerToken(req.headers.get("authorization"));
  if (!raw) return null;

  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) {
    logger.error("[mobile-auth] NEXTAUTH_SECRET is not set — bearer auth disabled");
    return null;
  }

  let token: Awaited<ReturnType<typeof decode>>;
  try {
    // decode() verifies the signature and the exp claim, and returns null on failure.
    token = await decode({ token: raw, secret });
  } catch (err) {
    logger.debug({ err }, "[mobile-auth] bearer token failed to decode");
    return null;
  }

  if (!token?.id || typeof token.iat !== "number") return null;

  // Same revocation path as the web token, so "sign out everywhere" covers both
  // clients at once and ADMIN tokens keep their shorter cache TTL.
  const revoked = await isTokenRevoked(
    token.id as string,
    token.iat,
    token.role as string | undefined,
  );
  if (revoked) return null;

  const user = buildSessionUser({
    id:               token.id as string,
    role:             token.role as Role,
    verificationTier: token.verificationTier as VerificationTier,
    tourCompleted:    Boolean(token.tourCompleted),
  });

  return {
    user: {
      ...user,
      email: (token.email as string | undefined) ?? "",
      name:  (token.name as string | null | undefined) ?? null,
    },
    sessionExpiry: token.sessionExpiry as number,
    expires:       new Date(((token.exp as number) ?? 0) * 1000).toISOString(),
  };
}
