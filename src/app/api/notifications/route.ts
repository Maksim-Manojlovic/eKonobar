import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/with-role";
import { db } from "@/lib/core/db";

export const GET = withAuth(async (_req, _ctx, session) => {
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

  return NextResponse.json({ notifications, unreadCount });
});

export const PATCH = withAuth(async (req, _ctx, session) => {
  const body = await req.json().catch(() => ({}));
  const ids: string[] | undefined = (body as { ids?: string[] }).ids;

  if (ids && ids.length > 0) {
    await db.notification.updateMany({
      where: { id: { in: ids }, userId: session.user.id },
      data: { read: true },
    });
  } else {
    // Mark all read
    await db.notification.updateMany({
      where: { userId: session.user.id, read: false },
      data: { read: true },
    });
  }

  return NextResponse.json({ ok: true });
});
