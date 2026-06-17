import { NextRequest, NextResponse } from "next/server";
import { dbRaw } from "@/lib/core/db";
import logger from "@/lib/core/logger";

export async function GET(req: NextRequest) {
  const appUrl      = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const orderNumber = new URL(req.url).searchParams.get("order_number") ?? "";

  if (orderNumber) {
    await dbRaw.passportPayment.updateMany({
      where: { orderNumber, status: "PENDING" },
      data:  { status: "CANCELLED" },
    }).catch((err) => logger.error({ err, orderNumber }, "monri cancel: failed to mark payment CANCELLED"));
  }

  return NextResponse.redirect(`${appUrl}/waiter?payment=cancelled`);
}
