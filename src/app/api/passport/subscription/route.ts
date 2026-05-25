import { NextResponse } from "next/server";
import { withRole } from "@/lib/auth/with-role";
import { db } from "@/lib/core/db";

export const GET = withRole("WAITER", async (_req, _ctx, session) => {
  const passport = await db.waiterPassport.findUnique({
    where: { userId: session.user.id },
    select: { passportTier: true, subscriptionExpiresAt: true },
  });

  if (!passport) {
    return NextResponse.json({ error: "Passport not found" }, { status: 404 });
  }

  const now = new Date();
  const isExpired = passport.subscriptionExpiresAt && passport.subscriptionExpiresAt < now;
  const activeTier = isExpired ? "FREE" : passport.passportTier;

  return NextResponse.json({
    tier: activeTier,
    subscriptionExpiresAt: passport.subscriptionExpiresAt,
    isActive: activeTier !== "FREE",
    daysRemaining: passport.subscriptionExpiresAt && !isExpired
      ? Math.ceil((passport.subscriptionExpiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      : 0,
  });
});
