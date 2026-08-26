/**
 * Token issuing and rotation for the native (Expo) app.
 *
 * The mobile client holds two things:
 *
 *   access token   — a NextAuth JWT, same payload and same NEXTAUTH_SECRET as the
 *                    web cookie, 15 min TTL. Deliberately not a bespoke format:
 *                    reusing it means `buildSessionUser` and `isTokenRevoked` work
 *                    unchanged, and an ADMIN mobile token gets the same short
 *                    revocation-cache TTL an ADMIN web token gets.
 *   refresh token  — an opaque 32-byte random value, 60 day TTL, rotated on every
 *                    use. Only its sha256 is stored, so a database leak yields no
 *                    usable session.
 *
 * Reuse of an already-rotated refresh token is treated as theft: the entire
 * device chain is revoked rather than just the presented row.
 */

import { createHash, randomBytes } from "node:crypto";
import { encode } from "next-auth/jwt";
import { db } from "@/lib/core/db";
import { buildJwtToken, type VerifiedUser } from "./helpers";

/** Access token TTL — short, because the refresh token is what carries the session. */
export const ACCESS_TTL_SECONDS = 15 * 60;

/** Refresh token TTL — long enough that a waiter is not re-typing a password monthly. */
export const REFRESH_TTL_MS = 60 * 24 * 60 * 60 * 1000;

function secret(): string {
  const s = process.env.NEXTAUTH_SECRET;
  if (!s) throw new Error("[mobile-auth] NEXTAUTH_SECRET is not set");
  return s;
}

/** sha256 hex. The raw refresh token is returned to the client once and never stored. */
export function hashRefreshToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

/**
 * Signs an access token carrying the same fields the web JWT carries, plus email
 * and name so `getBearerSession` can rebuild the full `Session` without a DB read.
 */
export async function issueAccessToken(user: VerifiedUser): Promise<string> {
  const fields = buildJwtToken({
    id:               user.id,
    role:             user.role,
    verificationTier: user.verificationTier,
    tourCompleted:    user.tourCompleted,
  });

  return encode({
    secret: secret(),
    maxAge: ACCESS_TTL_SECONDS,
    token:  { ...fields, email: user.email, name: user.name },
  });
}

export type DeviceInfo = {
  deviceId:    string;
  deviceName?: string | null;
  platform:    string;
};

/** Creates a refresh-token row and returns the raw token (the only time it exists in plaintext). */
export async function issueRefreshToken(
  userId: string,
  device: DeviceInfo,
): Promise<{ token: string; expiresAt: Date }> {
  const raw       = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + REFRESH_TTL_MS);

  await db.mobileRefreshToken.create({
    data: {
      userId,
      tokenHash:  hashRefreshToken(raw),
      deviceId:   device.deviceId,
      deviceName: device.deviceName ?? null,
      platform:   device.platform,
      expiresAt,
    },
  });

  return { token: raw, expiresAt };
}

export type RotateResult =
  | { ok: true;  userId: string; token: string; expiresAt: Date }
  | { ok: false; reason: "unknown" | "expired" | "reused" };

/**
 * Consumes a refresh token and issues its successor.
 *
 * `reused` means the presented token was already revoked — which, because rotation
 * revokes on every use, means either a replay or a stolen token racing the real
 * client. Both warrant killing the whole device chain, so the attacker's copy and
 * the victim's copy stop working together and the user is forced to sign in again.
 */
export async function rotateRefreshToken(raw: string): Promise<RotateResult> {
  const tokenHash = hashRefreshToken(raw);

  const existing = await db.mobileRefreshToken.findUnique({
    where:  { tokenHash },
    select: {
      id: true, userId: true, deviceId: true, deviceName: true,
      platform: true, expiresAt: true, revokedAt: true,
    },
  });

  if (!existing) return { ok: false, reason: "unknown" };

  if (existing.revokedAt) {
    await revokeDeviceChain(existing.userId, existing.deviceId);
    return { ok: false, reason: "reused" };
  }

  if (existing.expiresAt.getTime() <= Date.now()) {
    return { ok: false, reason: "expired" };
  }

  const next      = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + REFRESH_TTL_MS);

  // One transaction so a crash between the two writes cannot leave both tokens
  // live (which would silently defeat reuse detection).
  await db.$transaction([
    db.mobileRefreshToken.update({
      where: { id: existing.id },
      data:  { revokedAt: new Date(), lastUsedAt: new Date() },
    }),
    db.mobileRefreshToken.create({
      data: {
        userId:     existing.userId,
        tokenHash:  hashRefreshToken(next),
        deviceId:   existing.deviceId,
        deviceName: existing.deviceName,
        platform:   existing.platform,
        expiresAt,
      },
    }),
  ]);

  return { ok: true, userId: existing.userId, token: next, expiresAt };
}

/** Revokes a single refresh token. Idempotent — an unknown or already-revoked token is a no-op. */
export async function revokeRefreshToken(raw: string): Promise<void> {
  await db.mobileRefreshToken.updateMany({
    where: { tokenHash: hashRefreshToken(raw), revokedAt: null },
    data:  { revokedAt: new Date() },
  });
}

/** Revokes every live refresh token for one install. Used on logout and on reuse detection. */
export async function revokeDeviceChain(userId: string, deviceId: string): Promise<void> {
  await db.mobileRefreshToken.updateMany({
    where: { userId, deviceId, revokedAt: null },
    data:  { revokedAt: new Date() },
  });
}
