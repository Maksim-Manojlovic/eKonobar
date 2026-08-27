/**
 * POST /api/mobile/auth/login — password sign-in for the native app.
 *
 * Same User table, same bcrypt hashes and the same two login rate limits as the
 * web credentials provider: this route reuses `checkLoginRateLimit` and
 * `verifyCredentials` rather than reimplementing them, so a brute-force attempt
 * cannot dodge the limits by switching transport.
 */

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { parseBody } from "@/lib/auth/parse-body";
import { checkLoginRateLimit, verifyCredentials } from "@/lib/auth/helpers";
import { ACCESS_TTL_SECONDS, issueAccessToken, issueRefreshToken } from "@/lib/auth/mobile-tokens";
import { getClientIp } from "@/lib/core/ip";
import logger from "@/lib/core/logger";

const Schema = z.object({
  email:      z.string().email(),
  password:   z.string().min(1),
  deviceId:   z.string().min(1).max(128),
  deviceName: z.string().max(128).optional(),
  platform:   z.enum(["ios", "android"]),
});

export async function POST(req: NextRequest): Promise<Response> {
  const parsed = await parseBody(Schema, req);
  if (!parsed.ok) return parsed.response;

  const { email: rawEmail, password, deviceId, deviceName, platform } = parsed.data;
  const email = rawEmail.toLowerCase();

  try {
    await checkLoginRateLimit(getClientIp(req), email);
  } catch (err) {
    // checkLoginRateLimit signals "limit exceeded" by throwing a user-facing
    // Serbian message; NextAuth surfaces it the same way on the web.
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Previše pokušaja prijave." },
      { status: 429 },
    );
  }

  const user = await verifyCredentials(email, password);
  if (!user) {
    // Same response for unknown email and wrong password — no account enumeration.
    return NextResponse.json({ error: "Pogrešan email ili lozinka." }, { status: 401 });
  }

  const [accessToken, refresh] = await Promise.all([
    issueAccessToken(user),
    issueRefreshToken(user.id, { deviceId, deviceName, platform }),
  ]);

  logger.info({ userId: user.id, platform, deviceId }, "mobile login");

  return NextResponse.json({
    accessToken,
    refreshToken:     refresh.token,
    expiresIn:        ACCESS_TTL_SECONDS,
    refreshExpiresAt: refresh.expiresAt.toISOString(),
    user: {
      id:               user.id,
      email:            user.email,
      name:             user.name,
      role:             user.role,
      verificationTier: user.verificationTier,
      tourCompleted:    user.tourCompleted,
    },
  });
}
