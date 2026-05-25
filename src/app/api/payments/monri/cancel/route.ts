import { NextRequest, NextResponse } from "next/server";
import { dbRaw } from "@/lib/core/db";

export async function GET(req: NextRequest) {
  const appUrl      = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const orderNumber = new URL(req.url).searchParams.get("order_number") ?? "";

  if (orderNumber) {
    await dbRaw.passportPayment.updateMany({
      where: { orderNumber, status: "PENDING" },
      data:  { status: "CANCELLED" },
    }).catch(() => {});
  }

  return NextResponse.redirect(`${appUrl}/waiter?payment=cancelled`);
}
