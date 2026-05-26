import { NextResponse } from "next/server";
import { withRole } from "@/lib/auth/with-role";
import { dbRaw } from "@/lib/core/db";
import { logAudit } from "@/lib/core/audit";
import { parseBody } from "@/lib/auth/parse-body";
import { z } from "zod";

const AdminUserPatchSchema = z.object({
  role:   z.enum(["WAITER", "VENUE_OWNER", "HEADHUNTER", "ADMIN"]).optional(),
  action: z.enum(["delete", "restore"]).optional(),
});

export const PATCH = withRole<{ params: Promise<{ id: string }> }>("ADMIN", async (req, ctx, session) => {
  const { id } = await ctx.params;

  // Prevent self-modification
  if (id === session.user.id) {
    return NextResponse.json({ error: "Cannot modify own account" }, { status: 400 });
  }

  const parsed = await parseBody(AdminUserPatchSchema, req);
  if (!parsed.ok) return parsed.response;
  const { role, action } = parsed.data;

  const data: Record<string, unknown> = {};

  if (role) data.role = role;
  if (action === "delete")  data.deletedAt = new Date();
  if (action === "restore") data.deletedAt = null;

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const needsRevocation = data.role !== undefined || data.deletedAt !== undefined;

  const [user] = await dbRaw.$transaction([
    dbRaw.user.update({
      where: { id },
      data,
      select: { id: true, name: true, email: true, role: true, deletedAt: true },
    }),
    ...(needsRevocation
      ? [dbRaw.tokenRevocation.upsert({
          where:  { userId: id },
          create: { userId: id, revokedAt: new Date() },
          update: { revokedAt: new Date() },
        })]
      : []),
  ]);

  const auditAction = data.role !== undefined
    ? "USER_ROLE_CHANGED"
    : action === "delete"
    ? "USER_DELETED"
    : "USER_RESTORED";
  logAudit(session.user.id, auditAction, id, "User",
    data.role !== undefined ? { role: String(data.role) } : undefined);

  return NextResponse.json(user);
});
