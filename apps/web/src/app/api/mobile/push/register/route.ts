/**
 * POST /api/mobile/push/register — records this install's Expo push token.
 *
 * The native counterpart to POST /api/push/subscribe. Called after the app is
 * granted notification permission, and again on every cold start, because Expo
 * tokens rotate — re-registering is the normal case, not an error.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuth } from "@/lib/auth/with-role";
import { parseBody } from "@/lib/auth/parse-body";
import { db } from "@/lib/core/db";
import { bustNotifyPrefsCache } from "@/lib/notifications/notify";
import { isExpoPushToken } from "@/lib/integrations/expo-push";

const Schema = z.object({
  token:    z.string().min(1).refine(isExpoPushToken, {
    message: "Not an Expo push token (expected ExponentPushToken[...])",
  }),
  platform: z.enum(["ios", "android"]),
  deviceId: z.string().min(1).max(128),
});

export const POST = withAuth(async (req, _ctx, session) => {
  const parsed = await parseBody(Schema, req);
  if (!parsed.ok) return parsed.response;

  const { token, platform, deviceId } = parsed.data;

  // Upsert on `token`, not on (userId, deviceId): the same physical device can
  // be handed to another person, and the token must then move to the new
  // account rather than being duplicated across both.
  await db.deviceToken.upsert({
    where:  { token },
    create: { token, platform, deviceId, userId: session.user.id },
    update: { platform, deviceId, userId: session.user.id, lastSeenAt: new Date() },
  });

  bustNotifyPrefsCache(session.user.id);

  return new NextResponse(null, { status: 204 });
});
