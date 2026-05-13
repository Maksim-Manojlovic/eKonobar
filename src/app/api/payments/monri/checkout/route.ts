import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { createPaymentSession } from "@/lib/monri";
import { PassportTier } from "@prisma/client";
import crypto from "crypto";

const TIER_AMOUNT_RSD: Record<Exclude<PassportTier, "FREE">, number> = {
  PRO:      29000,  // 290.00 RSD in minor units
  PRO_PLUS: 49000,  // 490.00 RSD in minor units
};

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "WAITER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { tier } = body as { tier: PassportTier };

  if (!tier || tier === "FREE" || !(tier in TIER_AMOUNT_RSD)) {
    return NextResponse.json({ error: "Invalid tier" }, { status: 400 });
  }

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { name: true, email: true },
  });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const orderNumber = `EK-${crypto.randomUUID().replace(/-/g, "").slice(0, 16).toUpperCase()}`;
  const amountMinorUnits = TIER_AMOUNT_RSD[tier as Exclude<PassportTier, "FREE">];

  // Create pending payment record — prevents duplicate activations
  await db.passportPayment.create({
    data: {
      userId:      session.user.id,
      orderNumber,
      tier,
      amountRsd:   amountMinorUnits,
      status:      "PENDING",
    },
  });

  const paymentSession = await createPaymentSession({
    orderNumber,
    amountMinorUnits,
    currency:    "RSD",
    chFullName:  user.name ?? "eKonobar Korisnik",
    chEmail:     user.email,
    tokenizePan: true,
  });

  return NextResponse.json({ paymentUrl: paymentSession.paymentUrl });
}
