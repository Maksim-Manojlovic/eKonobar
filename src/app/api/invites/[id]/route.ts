import { NextResponse } from "next/server";
import { withRole } from "@/lib/with-role";
import { db } from "@/lib/db";

export const PATCH = withRole<{ params: Promise<{ id: string }> }>("WAITER", async (req, ctx, session) => {
  const { id } = await ctx.params;
  const invite = await db.invite.findFirst({
    where: { id, recipientId: session.user.id, type: "JOB_INVITE" },
  });
  if (!invite) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (invite.status !== "PENDING") {
    return NextResponse.json({ error: "Already responded" }, { status: 400 });
  }

  const body = await req.json();
  const { status } = body;

  if (status !== "ACCEPTED" && status !== "DECLINED") {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  try {
    const updated = await db.invite.update({
      where: { id },
      data: {
        status,
        usedAt: status === "ACCEPTED" ? new Date() : undefined,
      },
    });
    return NextResponse.json(updated);
  } catch (err) {
    console.error("[PATCH /api/invites/[id]]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
});
