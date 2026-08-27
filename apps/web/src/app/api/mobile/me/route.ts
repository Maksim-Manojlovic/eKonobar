/**
 * GET /api/mobile/me — who the bearer token belongs to.
 *
 * The app calls this on cold start to decide between "resume" and "show login".
 * It is a normal `withAuth` route, so it also serves as the smoke test that the
 * bearer path in with-role.ts is wired: if this returns 200 for a native client,
 * every other route does too.
 */

import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/with-role";

export const GET = withAuth(async (_req, _ctx, session) => {
  return NextResponse.json({ user: session.user });
});
