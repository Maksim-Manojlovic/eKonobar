import { NextResponse } from "next/server";
import { withRole } from "@/lib/auth/with-role";
import { db } from "@/lib/core/db";
import { parseBody } from "@/lib/auth/parse-body";
import { z } from "zod";

const InviteRespondSchema = z.object({
  status: z.enum(["ACCEPTED", "DECLINED"]),
});

export const PATCH = withRole<{ params: Promise<{ id: string }> }>("WAITER", async (req, ctx, session) => {
  const { id } = await ctx.params;
  const invite = await db.invite.findFirst({
    where: { id, recipientId: session.user.id, type: "JOB_INVITE" },
  });
  if (!invite) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (invite.status !== "PENDING") {
    return NextResponse.json({ error: "Already responded" }, { status: 400 });
  }

  const parsed = await parseBody(InviteRespondSchema, req);
  if (!parsed.ok) return parsed.response;
  const { status } = parsed.data;

  const updated = await db.invite.update({
    where: { id },
    data: {
      status,
      usedAt: status === "ACCEPTED" ? new Date() : undefined,
    },
  });
  return NextResponse.json(updated);
});
