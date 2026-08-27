import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/with-role";
import { db } from "@/lib/core/db";
import { parseBody } from "@/lib/auth/parse-body";
import { z } from "zod";

/**
 * WAITER is the only role a person can give themselves.
 *
 * This is the picker a first-time OAuth user sees. It used to accept
 * VENUE_OWNER, which made it the same self-service back door the register route
 * had; owner accounts are granted by an admin (see api/auth/register/route.ts).
 * With only one option left the picker is a formality, but the endpoint stays so
 * the OAuth onboarding flow has something to call.
 */
const SetRoleSchema = z.object({
  role: z.literal("WAITER"),
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

  if (!current) return NextResponse.json({ error: "Korisnik nije pronađen" }, { status: 404 });

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
