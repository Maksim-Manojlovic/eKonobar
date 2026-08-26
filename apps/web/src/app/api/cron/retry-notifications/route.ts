import { NextRequest, NextResponse } from "next/server";
import { dbRaw } from "@/lib/core/db";
import { isCronAuthorized } from "@/lib/auth/cron-auth";
import { retryWhatsApp, retrySms, retryDevicePush } from "@/lib/notifications/retry";

// Vercel: raise the Hobby 10s function cap — WhatsApp/SMS sends can run long. Ignored on Docker.
export const maxDuration = 60;

// Retries failed WhatsApp, SMS and native (Expo) push notification sends.
// Max 3 attempts per channel, within 24h of creation.
// Requires: Authorization: Bearer <CRON_SECRET>
//
// Vercel cron: "0 * * * *" (hourly)

const MAX_RETRIES = 3;
const WINDOW_MS   = 24 * 60 * 60 * 1000;

async function run() {
  const since = new Date(Date.now() - WINDOW_MS);

  const pending = await dbRaw.notification.findMany({
    where: {
      createdAt: { gte: since },
      OR: [
        {
          waSent: false,
          waRetries: { lt: MAX_RETRIES },
          user: { deletedAt: null, waOptIn: true, phone: { not: null } },
        },
        {
          smsSent: false,
          smsRetries: { lt: MAX_RETRIES },
          user: { deletedAt: null, smsOptIn: true, phone: { not: null } },
        },
        {
          // No opt-in flag: registering a device token IS the opt-in, exactly
          // as having a PushSubscription row is on the web.
          devicePushSent: false,
          devicePushRetries: { lt: MAX_RETRIES },
          user: { deletedAt: null, deviceTokens: { some: {} } },
        },
      ],
    },
    select: {
      id:         true,
      title:      true,
      body:       true,
      link:       true,
      waSent:            true,
      waRetries:         true,
      smsSent:           true,
      smsRetries:        true,
      devicePushSent:    true,
      devicePushRetries: true,
      user: {
        select: {
          phone:        true,
          waOptIn:      true,
          smsOptIn:     true,
          deviceTokens: { select: { id: true, token: true } },
        },
      },
    },
    take: 100,
  });

  let waSent = 0, waFailed = 0, smsSent = 0, smsFailed = 0, devicePushSent = 0, devicePushFailed = 0;

  await Promise.all(
    pending.map(async (n) => {
      const { user } = n;

      if (
        !n.devicePushSent &&
        n.devicePushRetries < MAX_RETRIES &&
        user.deviceTokens.length > 0
      ) {
        const r = await retryDevicePush(n.id, user.deviceTokens, n.title, n.body, n.link);
        if (r === "sent")   devicePushSent++;
        if (r === "failed") devicePushFailed++;
      }

      // The two phone channels below share this guard; device push above does not
      // depend on a phone number, so it must run before the early return.
      if (!user.phone) return;

      if (!n.waSent && n.waRetries < MAX_RETRIES && user.waOptIn) {
        const r = await retryWhatsApp(n.id, user.phone, n.title, n.body);
        if (r === "sent")   waSent++;
        if (r === "failed") waFailed++;
      }

      if (!n.smsSent && n.smsRetries < MAX_RETRIES && user.smsOptIn) {
        const r = await retrySms(n.id, user.phone, n.title, n.body, n.link);
        if (r === "sent")   smsSent++;
        if (r === "failed") smsFailed++;
      }
    }),
  );

  return { checked: pending.length, waSent, waFailed, smsSent, smsFailed, devicePushSent, devicePushFailed };
}

export async function GET(req: NextRequest) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await run());
}

export async function POST(req: NextRequest) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await run());
}
