import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/with-role";
import { db } from "@/lib/core/db";

export const PATCH = withAuth(async (_req, _ctx, session) => {
  await db.user.update({
    where: { id: session.user.id },
    data: { tourCompleted: true },
  });

  return NextResponse.json({ ok: true });
});
