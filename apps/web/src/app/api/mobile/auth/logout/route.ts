/**
 * POST /api/mobile/auth/logout — revokes one refresh token.
 *
 * Deliberately unauthenticated and idempotent: a client whose access token has
 * already expired still needs to be able to clean up, and an unknown or
 * already-revoked token is not an error worth reporting. Always 204.
 *
 * Note this is a per-device logout. "Sign out everywhere" is the existing
 * TokenRevocation path, which covers the web cookie and every mobile install at
 * once because both carry the same JWT shape.
 */

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { parseBody } from "@/lib/auth/parse-body";
import { revokeRefreshToken } from "@/lib/auth/mobile-tokens";

const Schema = z.object({ refreshToken: z.string().min(1) });

export async function POST(req: NextRequest): Promise<Response> {
  const parsed = await parseBody(Schema, req);
  if (!parsed.ok) return parsed.response;

  await revokeRefreshToken(parsed.data.refreshToken);

  return new NextResponse(null, { status: 204 });
}
