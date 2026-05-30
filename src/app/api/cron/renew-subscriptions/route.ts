import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { dbRaw } from "@/lib/core/db";
import { chargeStoredCard } from "@/lib/integrations/monri";
import { notify } from "@/lib/notifications/notify";
import { isCronAuthorized } from "@/lib/auth/cron-auth";
import { PassportTier } from "@prisma/client";
import logger from "@/lib/core/logger";
import { SUBSCRIPTION_DURATION_MS } from "@/lib/passport/constants";
import { decryptToken } from "@/lib/core/encryption";
import { redis } from "@/lib/core/redis";

const TIER_AMOUNT_RSD: Record<Exclude<PassportTier, "FREE">, number> = {
  PRO:      29000,
  PRO_PLUS: 49000,
};

async function run() {
  // Cron-level lock: prevents two concurrent cron triggers (e.g. dual GET+POST or late re-fire)
  // from charging the same users twice within the same 5-minute window.
  if (redis) {
    const cronLock = await redis.set("cron:renew-subscriptions:running", "1", "EX", 300, "NX").catch(() => null);
    if (cronLock === null) {
      // Another instance is already running — skip silently.
      return { checked: 0, renewed: 0, failed: 0, skipped: "already running" };
    }
  }

  const now         = new Date();
  const windowStart = new Date(now.getTime() - 60 * 60 * 1000);       // 1h grace past expiry
  const windowEnd   = new Date(now.getTime() + 25 * 60 * 60 * 1000);  // 25h ahead — daily cron window

  const expiring = await dbRaw.waiterPassport.findMany({
    where: {
      monriPanToken:         { not: null },
      passportTier:          { in: ["PRO", "PRO_PLUS"] },
      subscriptionExpiresAt: { gte: windowStart, lte: windowEnd },
    },
    select: {
      userId:                true,
      passportTier:          true,
      subscriptionExpiresAt: true,
      monriPanToken:         true,
      user: { select: { email: true, name: true } },
    },
  });

  let renewed = 0;
  let failed  = 0;

  for (const passport of expiring) {
    // Per-user Redis lock: atomic guard against concurrent cron runs charging the same user.
    // The 2h DB dedup check below is the fallback when Redis is unavailable.
    if (redis) {
      const userLock = await redis
        .set(`renewal:lock:${passport.userId}`, "1", "EX", 3600, "NX")
        .catch(() => null);
      if (userLock === null) continue; // another instance is handling this user
    }

    // Dedup: skip if a payment attempt was already made in the last 2h for this user
    const recent = await dbRaw.passportPayment.findFirst({
      where: {
        userId:    passport.userId,
        status:    { in: ["PENDING", "SUCCESS"] },
        createdAt: { gte: new Date(now.getTime() - 2 * 60 * 60 * 1000) },
      },
    });
    if (recent) continue;

    const tier   = passport.passportTier as Exclude<PassportTier, "FREE">;
    const amount = TIER_AMOUNT_RSD[tier];
    if (!amount) continue;

    const orderNumber = `EK-${crypto.randomUUID().replace(/-/g, "").slice(0, 16).toUpperCase()}`;

    await dbRaw.passportPayment.create({
      data: { userId: passport.userId, orderNumber, tier, amountRsd: amount, status: "PENDING" },
    });

    const { approved, approvalCode } = await chargeStoredCard({
      panToken:         decryptToken(passport.monriPanToken!),
      orderNumber,
      amountMinorUnits: amount,
      currency:         "RSD",
      chEmail:          passport.user.email,
      chFullName:       passport.user.name ?? "eKonobar Subscriber",
    }).catch(() => ({ approved: false, approvalCode: undefined }));

    if (approved) {
      // Extend from current expiry to avoid date drift on late cron runs
      const base      = passport.subscriptionExpiresAt ?? now;
      const newExpiry = new Date(base.getTime() + SUBSCRIPTION_DURATION_MS);

      await dbRaw.$transaction([
        dbRaw.passportPayment.update({
          where: { orderNumber },
          data:  { status: "SUCCESS", monriApprovalCode: approvalCode ?? null },
        }),
        dbRaw.waiterPassport.update({
          where: { userId: passport.userId },
          data:  { subscriptionExpiresAt: newExpiry },
        }),
      ]);

      notify(
        passport.userId,
        "APPLICATION_STATUS_CHANGED",
        "Pretplata obnovljena",
        `${tier === "PRO_PLUS" ? "PRO+" : "PRO"} aktivan do ${newExpiry.toLocaleDateString("sr-RS")}.`,
        "/waiter",
      ).catch(err => logger.error({ err, userId: passport.userId }, "notify failed after subscription renewal"));

      renewed++;
    } else {
      await dbRaw.$transaction([
        dbRaw.passportPayment.update({
          where: { orderNumber },
          data:  { status: "FAILED" },
        }),
        dbRaw.waiterPassport.update({
          where: { userId: passport.userId },
          data:  { tierRank: 0 },
        }),
      ]);

      // subscriptionExpiresAt lapses naturally — user sees FREE features once past expiry.
      notify(
        passport.userId,
        "APPLICATION_STATUS_CHANGED",
        "Obnova pretplate nije uspela",
        "Naplata kartice nije prošla. Obnovi pretplatu ručno u dashboardu.",
        "/waiter",
      ).catch(err => logger.error({ err, userId: passport.userId }, "notify failed after subscription renewal failure"));

      failed++;
    }
  }

  return { checked: expiring.length, renewed, failed };
}

export async function GET(req: NextRequest) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await run());
}

export async function POST(req: NextRequest) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await run());
}
