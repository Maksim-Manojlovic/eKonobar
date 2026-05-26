import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/with-role";
import { db } from "@/lib/core/db";
import { parseBody } from "@/lib/auth/parse-body";
import { z } from "zod";

const SetRoleSchema = z.object({
  role: z.enum(["WAITER", "VENUE_OWNER", "HEADHUNTER"]),
});

export const PATCH = withAuth(async (req, _ctx, session) => {
  const parsed = await parseBody(SetRoleSchema, req);
  if (!parsed.ok) return parsed.response;
  const { role } = parsed.data;

  await db.user.update({
    where: { id: session.user.id },
    data:  { role },
  });

  return NextResponse.json({ ok: true, role });
});
