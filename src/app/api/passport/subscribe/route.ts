import { NextResponse } from "next/server";
import { withRole } from "@/lib/auth/with-role";
import { db } from "@/lib/core/db";
import { PassportTier } from "@prisma/client";
import { SUBSCRIPTION_DURATION_MS } from "@/lib/passport/constants";
import { parseBody } from "@/lib/auth/parse-body";
import { z } from "zod";

const SubscribeSchema = z.object({
  tier: z.nativeEnum(PassportTier),
});

const TIER_PRICES: Record<PassportTier, number> = {
  FREE: 0,
  PRO: 290,
  PRO_PLUS: 490,
};

const TIER_RANK: Record<PassportTier, number> = {
  FREE: 0,
  PRO: 1,
  PRO_PLUS: 2,
};

export const POST = withRole("WAITER", async (req, _ctx, session) => {
  const parsed = await parseBody(SubscribeSchema, req);
  if (!parsed.ok) return parsed.response;
  const { tier } = parsed.data;

  const passport = await db.waiterPassport.findUnique({
    where: { userId: session.user.id },
    select: { passportTier: true, subscriptionExpiresAt: true },
  });

  if (!passport) {
    return NextResponse.json({ error: "Passport not found" }, { status: 404 });
  }

  if (tier === "FREE") {
    await db.waiterPassport.update({
      where: { userId: session.user.id },
      data: { passportTier: "FREE", subscriptionExpiresAt: null, tierRank: 0 },
    });
    return NextResponse.json({ tier: "FREE", message: "Pretplata otkazana" });
  }

  // Extend or start subscription: +30 days from now (or from current expiry if still active)
  const now = new Date();
  const base = passport.subscriptionExpiresAt && passport.subscriptionExpiresAt > now
    ? passport.subscriptionExpiresAt
    : now;
  const subscriptionExpiresAt = new Date(base.getTime() + SUBSCRIPTION_DURATION_MS);

  const updated = await db.waiterPassport.update({
    where: { userId: session.user.id },
    data: { passportTier: tier, subscriptionExpiresAt, tierRank: TIER_RANK[tier] },
    select: { passportTier: true, subscriptionExpiresAt: true },
  });

  return NextResponse.json({
    tier: updated.passportTier,
    subscriptionExpiresAt: updated.subscriptionExpiresAt,
    priceRsd: TIER_PRICES[tier],
    message: `Passport ${tier} aktivan do ${subscriptionExpiresAt.toLocaleDateString("sr-RS")}`,
  });
});
