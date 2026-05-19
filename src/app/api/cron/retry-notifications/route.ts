import { NextRequest, NextResponse } from "next/server";
import { dbRaw } from "@/lib/db";
import { sendWhatsApp } from "@/lib/whatsapp";
import { sendSms } from "@/lib/sms";

// Retries failed WhatsApp and SMS notification sends.
// Max 3 attempts per channel, within 24h of creation.
// Requires: Authorization: Bearer <CRON_SECRET>
//
// Vercel cron: "0 * * * *" (hourly)

const MAX_RETRIES = 3;
const WINDOW_MS   = 24 * 60 * 60 * 1000;

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

function isActivePro(passport: { passportTier: string; subscriptionExpiresAt: Date | null } | null) {
  if (!passport) return false;
  const active = passport.subscriptionExpiresAt
    ? passport.subscriptionExpiresAt > new Date()
    : false;
  return active && (passport.passportTier === "PRO" || passport.passportTier === "PRO_PLUS");
}

function isActiveProPlus(passport: { passportTier: string; subscriptionExpiresAt: Date | null } | null) {
  if (!passport) return false;
  const active = passport.subscriptionExpiresAt
    ? passport.subscriptionExpiresAt > new Date()
    : false;
  return active && passport.passportTier === "PRO_PLUS";
}

async function run() {
  const since = new Date(Date.now() - WINDOW_MS);

  const pending = await dbRaw.notification.findMany({
    where: {
      createdAt: { gte: since },
      user: { deletedAt: null },
      OR: [
        { waSent: false,  waRetries:  { lt: MAX_RETRIES } },
        { smsSent: false, smsRetries: { lt: MAX_RETRIES } },
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
          phone:    true,
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

      // WhatsApp retry
      if (!n.waSent && n.waRetries < MAX_RETRIES && user.waOptIn && user.phone && isActivePro(user.waiterPassport)) {
        try {
          await sendWhatsApp(user.phone, n.title, n.body);
          await dbRaw.notification.update({ where: { id: n.id }, data: { waSent: true } });
          waSent++;
        } catch {
          await dbRaw.notification.update({
            where: { id: n.id },
            data:  { waRetries: { increment: 1 } },
          });
          waFailed++;
        }
      }

      // SMS retry
      if (!n.smsSent && n.smsRetries < MAX_RETRIES && user.smsOptIn && user.phone && isActiveProPlus(user.waiterPassport)) {
        const smsText = `${n.title}: ${n.body}${n.link ? " | ekonobar.rs" : ""}`.slice(0, 160);
        try {
          await sendSms(user.phone, smsText);
          await dbRaw.notification.update({ where: { id: n.id }, data: { smsSent: true } });
          smsSent++;
        } catch {
          await dbRaw.notification.update({
            where: { id: n.id },
            data:  { smsRetries: { increment: 1 } },
          });
          smsFailed++;
        }
      }
    }),
  );

  return { checked: pending.length, waSent, waFailed, smsSent, smsFailed };
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await run());
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await run());
}
