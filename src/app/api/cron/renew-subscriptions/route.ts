import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { dbRaw } from "@/lib/db";
import { chargeStoredCard } from "@/lib/monri";
import { notify } from "@/lib/notify";
import { PassportTier } from "@prisma/client";

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

const TIER_AMOUNT_RSD: Record<Exclude<PassportTier, "FREE">, number> = {
  PRO:      29000,
  PRO_PLUS: 49000,
};

async function run() {
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
      panToken:         passport.monriPanToken!,
      orderNumber,
      amountMinorUnits: amount,
      currency:         "RSD",
      chEmail:          passport.user.email,
      chFullName:       passport.user.name ?? "eKonobar Subscriber",
    }).catch(() => ({ approved: false, approvalCode: undefined }));

    if (approved) {
      // Extend from current expiry to avoid date drift on late cron runs
      const base      = passport.subscriptionExpiresAt ?? now;
      const newExpiry = new Date(base.getTime() + 30 * 24 * 60 * 60 * 1000);

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
      ).catch(console.error);

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
      ).catch(console.error);

      failed++;
    }
  }

  return { checked: expiring.length, renewed, failed };
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await run());
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await run());
}
