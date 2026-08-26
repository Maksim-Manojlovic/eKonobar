import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/with-role";
import { db } from "@/lib/core/db";
import { parseBody } from "@/lib/auth/parse-body";
import { z } from "zod";
import { bustNotifyPrefsCache } from "@/lib/notifications/notify";

const NotifPrefsPatchSchema = z.object({
  phone:    z.string().max(20).nullish(),
  smsOptIn: z.boolean().optional(),
  waOptIn:  z.boolean().optional(),
});

export const GET = withAuth(async (_req, _ctx, session) => {
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { phone: true, smsOptIn: true, waOptIn: true },
  });

  return NextResponse.json(user ?? { phone: null, smsOptIn: false, waOptIn: false });
});

export const PATCH = withAuth(async (req, _ctx, session) => {
  const parsed = await parseBody(NotifPrefsPatchSchema, req);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;

  const data: { phone?: string | null; smsOptIn?: boolean; waOptIn?: boolean } = {};

  if ("phone" in body) {
    const p = body.phone?.trim() ?? null;
    data.phone = p || null;
  }
  if (body.smsOptIn !== undefined) data.smsOptIn = body.smsOptIn;
  if (body.waOptIn  !== undefined) data.waOptIn  = body.waOptIn;

  const user = await db.user.update({
    where: { id: session.user.id },
    data,
    select: { phone: true, smsOptIn: true, waOptIn: true },
  });

  bustNotifyPrefsCache(session.user.id);
  return NextResponse.json(user);
});
