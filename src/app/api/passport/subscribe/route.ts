import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { PassportTier } from "@prisma/client";

const TIER_PRICES: Record<PassportTier, number> = {
  FREE: 0,
  PRO: 290,
  PRO_PLUS: 490,
};

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "WAITER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { tier } = body as { tier: PassportTier };

  if (!tier || !Object.values(PassportTier).includes(tier)) {
    return NextResponse.json({ error: "Invalid tier" }, { status: 400 });
  }

  const passport = await db.waiterPassport.findUnique({
    where: { userId: session.user.id },
    select: { passportTier: true, subscriptionExpiresAt: true },
  });

  if (!passport) {
    return NextResponse.json({ error: "Passport not found" }, { status: 404 });
  }

  if (tier === "FREE") {
    // Downgrade: cancel at end of current period (keep until expiry, then lapse)
    await db.waiterPassport.update({
      where: { userId: session.user.id },
      // Don't clear subscriptionExpiresAt — let it lapse naturally
      data: { passportTier: "FREE", subscriptionExpiresAt: null },
    });
    return NextResponse.json({ tier: "FREE", message: "Pretplata otkazana" });
  }

  // Extend or start subscription: +30 days from now (or from current expiry if still active)
  const now = new Date();
  const base = passport.subscriptionExpiresAt && passport.subscriptionExpiresAt > now
    ? passport.subscriptionExpiresAt
    : now;
  const subscriptionExpiresAt = new Date(base.getTime() + 30 * 24 * 60 * 60 * 1000);

  // TODO: integrate payment provider (Stripe / NestPay) before charging.
  // For now this is a mock — records the tier change without actual payment.
  const updated = await db.waiterPassport.update({
    where: { userId: session.user.id },
    data: { passportTier: tier, subscriptionExpiresAt },
    select: { passportTier: true, subscriptionExpiresAt: true },
  });

  return NextResponse.json({
    tier: updated.passportTier,
    subscriptionExpiresAt: updated.subscriptionExpiresAt,
    priceRsd: TIER_PRICES[tier],
    message: `Passport ${tier} aktivan do ${subscriptionExpiresAt.toLocaleDateString("sr-RS")}`,
  });
}
