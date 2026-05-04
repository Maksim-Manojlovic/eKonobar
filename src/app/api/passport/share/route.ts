import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { randomBytes } from "crypto";

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "WAITER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

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
}
