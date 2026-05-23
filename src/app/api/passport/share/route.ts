import { NextResponse } from "next/server";
import { withRole } from "@/lib/with-role";
import { db } from "@/lib/db";
import { randomBytes } from "crypto";

export const POST = withRole("WAITER", async (_req, _ctx, session) => {
  const token = randomBytes(24).toString("base64url");
  const expiry = new Date();
  expiry.setDate(expiry.getDate() + 30); // 30-day link

  const passport = await db.waiterPassport.upsert({
    where: { userId: session.user.id },
    create: {
      userId: session.user.id,
      shareToken: token,
      shareTokenExpiry: expiry,
    },
    update: {
      shareToken: token,
      shareTokenExpiry: expiry,
    },
    select: { shareToken: true, shareTokenExpiry: true },
  });

  return NextResponse.json(passport);
});
