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

  // Guard: only new OAuth users (WAITER default, no passport yet) may select a role.
  // Blocks established WAITERs (passport exists) and any user already on a non-WAITER role
  // from switching roles after onboarding — prevents privilege escalation via this endpoint.
  const current = await db.user.findUnique({
    where:  { id: session.user.id },
    select: { role: true, waiterPassport: { select: { id: true } } },
  });

  if (!current) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isEstablished = current.role !== "WAITER" || current.waiterPassport !== null;
  if (isEstablished) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await db.user.update({
    where: { id: session.user.id },
    data:  { role },
  });

  return NextResponse.json({ ok: true, role });
});
