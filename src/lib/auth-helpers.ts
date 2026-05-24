import { compare } from "bcryptjs";
import { db } from "./db";
import { rateLimit } from "./rate-limit";
import type { Role, VerificationTier } from "@prisma/client";

// ── Constants ─────────────────────────────────────────────────────────────────

/** Standard session TTL — 24 h. */
export const TTL_DEFAULT  = 24 * 60 * 60;

/** "Remember me" session TTL — 7 d. */
export const TTL_REMEMBER =  7 * 24 * 60 * 60;

// ── Types ─────────────────────────────────────────────────────────────────────

/** User fields returned by verifyCredentials — no hashed password exposed. */
export type VerifiedUser = {
  id:               string;
  email:            string;
  name:             string | null;
  role:             Role;
  verificationTier: VerificationTier;
  tourCompleted:    boolean;
};

/** JWT payload fields written on initial sign-in. */
export type JwtFields = {
  id:               string;
  role:             Role;
  verificationTier: VerificationTier;
  tourCompleted:    boolean;
  sessionExpiry:    number;
};

// ── checkLoginRateLimit ───────────────────────────────────────────────────────

/**
 * Enforces two independent login rate limits (IP-based + email-based).
 * Throws on either limit exceeded — NextAuth surfaces the message to the user.
 *
 * - IP guard:    20 attempts / 15 min — stops distributed credential stuffing
 * - Email guard:  5 attempts / 15 min — stops targeted brute-force
 */
export async function checkLoginRateLimit(ip: string, email: string): Promise<void> {
  const ipAllowed = await rateLimit(`login:ip:${ip}`, 20, 15 * 60 * 1000);
  if (!ipAllowed) {
    throw new Error("Previše pokušaja prijave. Sačekaj 15 minuta.");
  }
  const emailAllowed = await rateLimit(`login:email:${email}`, 5, 15 * 60 * 1000);
  if (!emailAllowed) {
    throw new Error("Previše neuspelih pokušaja prijave. Sačekaj 15 minuta.");
  }
}

// ── verifyCredentials ─────────────────────────────────────────────────────────

/**
 * Looks up the user by email and verifies the password.
 * Returns the user record on success, null on any failure.
 *
 * Uses `db` (soft-delete filtered) so deleted accounts always return null.
 * OAuth-only accounts (no hashedPassword) also return null.
 */
export async function verifyCredentials(
  email: string,
  password: string,
): Promise<VerifiedUser | null> {
  const user = await db.user.findUnique({
    where:  { email },
    select: {
      id: true, email: true, name: true,
      role: true, verificationTier: true, tourCompleted: true,
      hashedPassword: true,
    },
  });
  if (!user?.hashedPassword) return null;
  const valid = await compare(password, user.hashedPassword);
  if (!valid) return null;
  return {
    id:               user.id,
    email:            user.email,
    name:             user.name,
    role:             user.role,
    verificationTier: user.verificationTier,
    tourCompleted:    user.tourCompleted,
  };
}

// ── buildJwtToken ─────────────────────────────────────────────────────────────

/**
 * Computes the JWT payload fields to write on initial sign-in.
 *
 * - `isOAuth = true`  → always uses TTL_DEFAULT (ignores rememberMe)
 * - `isOAuth = false` → uses TTL_REMEMBER when rememberMe is true
 *
 * `now` defaults to the current Unix timestamp; override in tests for
 * deterministic assertions without time mocking.
 */
export function buildJwtToken(
  user: {
    id:               string;
    role:             Role;
    verificationTier: VerificationTier;
    tourCompleted:    boolean;
    rememberMe?:      boolean;
  },
  isOAuth = false,
  now = Math.floor(Date.now() / 1000),
): JwtFields {
  const ttl = !isOAuth && user.rememberMe ? TTL_REMEMBER : TTL_DEFAULT;
  return {
    id:               user.id,
    role:             user.role,
    verificationTier: user.verificationTier,
    tourCompleted:    user.tourCompleted,
    sessionExpiry:    now + ttl,
  };
}

// ── buildSessionUser ──────────────────────────────────────────────────────────

/**
 * Maps JWT token fields onto the session.user shape.
 * Extracted so the session callback is a thin passthrough, and the mapping
 * itself can be verified independently.
 */
export function buildSessionUser(token: {
  id:               string;
  role:             Role;
  verificationTier: VerificationTier;
  tourCompleted:    boolean;
}): { id: string; role: Role; verificationTier: VerificationTier; tourCompleted: boolean } {
  return {
    id:               token.id,
    role:             token.role,
    verificationTier: token.verificationTier,
    tourCompleted:    token.tourCompleted,
  };
}
