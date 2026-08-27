/**
 * POST /api/mobile/auth/refresh — exchanges a refresh token for a new pair.
 *
 * Rotating: the presented token is revoked and a successor issued, so a token is
 * only ever valid once. Presenting an already-revoked token revokes the whole
 * device chain (see rotateRefreshToken) — the standard mitigation for theft.
 */

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { parseBody } from "@/lib/auth/parse-body";
import { ACCESS_TTL_SECONDS, issueAccessToken, rotateRefreshToken } from "@/lib/auth/mobile-tokens";
import { db } from "@/lib/core/db";
import logger from "@/lib/core/logger";

const Schema = z.object({ refreshToken: z.string().min(1) });

export async function POST(req: NextRequest): Promise<Response> {
  const parsed = await parseBody(Schema, req);
  if (!parsed.ok) return parsed.response;

  const rotated = await rotateRefreshToken(parsed.data.refreshToken);

  if (!rotated.ok) {
    if (rotated.reason === "reused") {
      logger.warn("mobile refresh token reused — device chain revoked");
    }
    // One response for every failure mode. Telling the client which of unknown /
    // expired / reused it hit would hand an attacker a probing oracle; the app's
    // reaction is identical in all three cases anyway: sign out and re-login.
    return NextResponse.json({ error: "Sesija je istekla. Prijavi se ponovo." }, { status: 401 });
  }

  // `db` is soft-delete filtered, so an account deleted since the token was issued
  // resolves to null here and cannot refresh its way back in.
  const user = await db.user.findUnique({
    where:  { id: rotated.userId },
    select: {
      id: true, email: true, name: true,
      role: true, verificationTier: true, tourCompleted: true,
    },
  });

  if (!user) {
    return NextResponse.json({ error: "Sesija je istekla. Prijavi se ponovo." }, { status: 401 });
  }

  const accessToken = await issueAccessToken(user);

  return NextResponse.json({
    accessToken,
    refreshToken:     rotated.token,
    expiresIn:        ACCESS_TTL_SECONDS,
    refreshExpiresAt: rotated.expiresAt.toISOString(),
  });
}
