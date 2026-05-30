import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/with-role";
import { db } from "@/lib/core/db";
import { redis } from "@/lib/core/redis";
import { parseBody } from "@/lib/auth/parse-body";
import { z } from "zod";

const NotificationPatchSchema = z.object({
  ids: z.array(z.string()).optional(),
});

export const GET = withAuth(async (_req, _ctx, session) => {
  const cacheKey = `notif:cache:${session.user.id}`;

  if (redis) {
    try {
      const cached = await redis.get(cacheKey);
      if (cached) return NextResponse.json(JSON.parse(cached));
    } catch {
      // Redis error — fall through to DB.
    }
  }

  const [notifications, unreadCount] = await Promise.all([
    db.notification.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
    db.notification.count({
      where: { userId: session.user.id, read: false },
    }),
  ]);

  const payload = { notifications, unreadCount };

  if (redis) {
    // 60 s TTL — client polls every 30 s, so most polls hit the cache.
    // Cache is busted immediately on new notification (notify.ts) or mark-read.
    redis.set(cacheKey, JSON.stringify(payload), "EX", 60).catch(() => {});
  }

  return NextResponse.json(payload);
});

export const PATCH = withAuth(async (req, _ctx, session) => {
  const parsed = await parseBody(NotificationPatchSchema, req);
  if (!parsed.ok) return parsed.response;
  const { ids } = parsed.data;

  if (ids && ids.length > 0) {
    await db.notification.updateMany({
      where: { id: { in: ids }, userId: session.user.id },
      data: { read: true },
    });
  } else {
    await db.notification.updateMany({
      where: { userId: session.user.id, read: false },
      data: { read: true },
    });
  }

  // Bust cache so the next GET reflects updated read state.
  if (redis) redis.del(`notif:cache:${session.user.id}`).catch(() => {});

  return NextResponse.json({ ok: true });
});
