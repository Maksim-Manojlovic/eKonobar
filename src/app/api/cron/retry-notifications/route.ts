import { NextRequest, NextResponse } from "next/server";
import { dbRaw } from "@/lib/core/db";
import { isCronAuthorized } from "@/lib/auth/cron-auth";
import { retryWhatsApp, retrySms } from "@/lib/notifications/retry";

// Vercel: raise the Hobby 10s function cap — WhatsApp/SMS sends can run long. Ignored on Docker.
export const maxDuration = 60;

// Retries failed WhatsApp and SMS notification sends.
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
      ],
    },
    select: {
      id:         true,
      title:      true,
      body:       true,
      link:       true,
      waSent:     true,
      waRetries:  true,
      smsSent:    true,
      smsRetries: true,
      user: {
        select: {
          role:    true,   // needed for role-bypass parity with notify()
          phone:   true,
          waOptIn:  true,
          smsOptIn: true,
          waiterPassport: {
            select: { passportTier: true, subscriptionExpiresAt: true },
          },
        },
      },
    },
    take: 100,
  });

  let waSent = 0, waFailed = 0, smsSent = 0, smsFailed = 0;

  await Promise.all(
    pending.map(async (n) => {
      const { user } = n;
      if (!user.phone) return;

      if (!n.waSent && n.waRetries < MAX_RETRIES && user.waOptIn) {
        const r = await retryWhatsApp(n.id, user.phone, user.role, user.waiterPassport, n.title, n.body);
        if (r === "sent")   waSent++;
        if (r === "failed") waFailed++;
      }

      if (!n.smsSent && n.smsRetries < MAX_RETRIES && user.smsOptIn) {
        const r = await retrySms(n.id, user.phone, user.role, user.waiterPassport, n.title, n.body, n.link);
        if (r === "sent")   smsSent++;
        if (r === "failed") smsFailed++;
      }
    }),
  );

  return { checked: pending.length, waSent, waFailed, smsSent, smsFailed };
}

export async function GET(req: NextRequest) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await run());
}

export async function POST(req: NextRequest) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await run());
}
