import { NextRequest, NextResponse } from "next/server";

// Monri redirects here after successful payment.
// Actual subscription activation happens in /callback (server-to-server).
// We just redirect to the waiter dashboard with a success flag.
export function GET(req: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const orderNumber = new URL(req.url).searchParams.get("order_number") ?? "";
  return NextResponse.redirect(
    `${appUrl}/waiter?payment=success&order=${orderNumber}`,
  );
}
