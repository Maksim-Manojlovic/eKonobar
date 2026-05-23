import { NextResponse } from "next/server";
import { withAuth } from "@/lib/with-role";
import { db } from "@/lib/db";

export const POST = withAuth(async (req, _ctx, session) => {
  const { endpoint, keys } = await req.json();
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return NextResponse.json({ error: "Invalid subscription" }, { status: 400 });
  }

  await db.pushSubscription.upsert({
    where: { endpoint },
    create: { userId: session.user.id, endpoint, p256dh: keys.p256dh, auth: keys.auth },
    update: { userId: session.user.id, p256dh: keys.p256dh, auth: keys.auth },
  });

  return NextResponse.json({ ok: true });
});

export const DELETE = withAuth(async (req, _ctx, session) => {
  const { endpoint } = await req.json();
  if (!endpoint) return NextResponse.json({ error: "endpoint required" }, { status: 400 });

  await db.pushSubscription.deleteMany({
    where: { endpoint, userId: session.user.id },
  });

  return NextResponse.json({ ok: true });
});
