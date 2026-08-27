/**
 * DELETE /api/mobile/push/unregister — drops this install's Expo push token.
 *
 * Called when the user turns notifications off in-app, and on sign-out. Scoped
 * to the caller's own rows so a token string cannot be used to unregister
 * somebody else's device. Idempotent — an unknown token is a 204, not a 404.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuth } from "@/lib/auth/with-role";
import { parseBody } from "@/lib/auth/parse-body";
import { db } from "@/lib/core/db";
import { bustNotifyPrefsCache } from "@/lib/notifications/notify";

const Schema = z.object({ token: z.string().min(1) });

export const DELETE = withAuth(async (req, _ctx, session) => {
  const parsed = await parseBody(Schema, req);
  if (!parsed.ok) return parsed.response;

  await db.deviceToken.deleteMany({
    where: { token: parsed.data.token, userId: session.user.id },
  });

  bustNotifyPrefsCache(session.user.id);

  return new NextResponse(null, { status: 204 });
});
