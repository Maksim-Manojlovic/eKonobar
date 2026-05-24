import { NextRequest, NextResponse } from "next/server";
import { dbRaw } from "@/lib/db";
import { verifyCallback, callbackApproved, type MonriCallbackPayload } from "@/lib/monri";
import { fireSideEffects } from "@/lib/side-effects";

export async function POST(req: NextRequest) {
  let payload: MonriCallbackPayload;

  const contentType = req.headers.get("content-type") ?? "";

  // Monri sends callback as application/x-www-form-urlencoded
  if (contentType.includes("application/x-www-form-urlencoded")) {
    const text = await req.text();
    const params = new URLSearchParams(text);
    payload = Object.fromEntries(params.entries()) as unknown as MonriCallbackPayload;
  } else {
    payload = await req.json();
  }

  // Verify digest — reject tampered callbacks
  if (!verifyCallback(payload)) {
    return NextResponse.json({ error: "Invalid digest" }, { status: 400 });
  }

  const payment = await dbRaw.passportPayment.findUnique({
    where: { orderNumber: payload.order_number },
    include: { user: { select: { id: true, email: true, waiterPassport: { select: { subscriptionExpiresAt: true } } } } },
  });

  if (!payment) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  // Fast path — already fully processed (common for Monri retries after success)
  if (payment.status === "SUCCESS") {
    return NextResponse.json({ ok: true });
  }

  // Atomic claim — SET callbackReceivedAt = now WHERE callbackReceivedAt IS NULL.
  // PostgreSQL serializes concurrent updates on the same row, so exactly one
  // concurrent or retried callback gets count=1. The others get count=0 and
  // return 200 without processing, preventing double-activation.
  const claim = await dbRaw.passportPayment.updateMany({
    where: { orderNumber: payload.order_number, callbackReceivedAt: null },
    data:  { callbackReceivedAt: new Date() },
  });
  if (claim.count === 0) {
    return NextResponse.json({ ok: true });
  }

  if (!callbackApproved(payload)) {
    await dbRaw.passportPayment.update({
      where: { orderNumber: payload.order_number },
      data:  { status: "FAILED", monriApprovalCode: payload.approval_code },
    });
    return NextResponse.json({ ok: true });
  }

  // Payment approved — activate subscription (+30 days from now or current expiry)
  const now     = new Date();
  const base    = payment.user.waiterPassport?.subscriptionExpiresAt;
  const startFrom = base && base > now ? base : now;
  const subscriptionExpiresAt = new Date(startFrom.getTime() + 30 * 24 * 60 * 60 * 1000);

  await dbRaw.$transaction([
    dbRaw.passportPayment.update({
      where: { orderNumber: payload.order_number },
      data: {
        status:           "SUCCESS",
        monriApprovalCode: payload.approval_code,
        monriPanToken:    payload.pan_token ?? null,
      },
    }),
    dbRaw.waiterPassport.update({
      where: { userId: payment.userId },
      data: {
        passportTier:         payment.tier,
        subscriptionExpiresAt,
        tierRank:             payment.tier === "PRO_PLUS" ? 2 : payment.tier === "PRO" ? 1 : 0,
        ...(payload.pan_token && { monriPanToken: payload.pan_token }),
      },
    }),
  ]);

  fireSideEffects({
    notifications: [{
      userId: payment.userId,
      type:   "APPLICATION_STATUS_CHANGED",
      title:  `Passport ${payment.tier} aktiviran`,
      body:   `Vaša pretplata je aktivna do ${subscriptionExpiresAt.toLocaleDateString("sr-RS")}.`,
      link:   "/waiter",
    }],
  });

  return NextResponse.json({ ok: true });
}
