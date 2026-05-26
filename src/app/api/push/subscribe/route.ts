import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/with-role";
import { db } from "@/lib/core/db";
import { parseBody } from "@/lib/auth/parse-body";
import { z } from "zod";

const PushSubscribeSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth:   z.string().min(1),
  }),
});

const PushUnsubscribeSchema = z.object({
  endpoint: z.string().min(1),
});

export const POST = withAuth(async (req, _ctx, session) => {
  const parsed = await parseBody(PushSubscribeSchema, req);
  if (!parsed.ok) return parsed.response;
  const { endpoint, keys } = parsed.data;

  await db.pushSubscription.upsert({
    where: { endpoint },
    create: { userId: session.user.id, endpoint, p256dh: keys.p256dh, auth: keys.auth },
    update: { userId: session.user.id, p256dh: keys.p256dh, auth: keys.auth },
  });

  return NextResponse.json({ ok: true });
});

export const DELETE = withAuth(async (req, _ctx, session) => {
  const parsed = await parseBody(PushUnsubscribeSchema, req);
  if (!parsed.ok) return parsed.response;
  const { endpoint } = parsed.data;

  await db.pushSubscription.deleteMany({
    where: { endpoint, userId: session.user.id },
  });

  return NextResponse.json({ ok: true });
});
