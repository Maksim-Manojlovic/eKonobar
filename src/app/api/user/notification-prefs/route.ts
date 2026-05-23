import { NextResponse } from "next/server";
import { withAuth } from "@/lib/with-role";
import { db } from "@/lib/db";

export const GET = withAuth(async (_req, _ctx, session) => {
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { phone: true, smsOptIn: true, waOptIn: true },
  });

  return NextResponse.json(user ?? { phone: null, smsOptIn: false, waOptIn: false });
});

export const PATCH = withAuth(async (req, _ctx, session) => {
  const body = await req.json();
  const data: { phone?: string | null; smsOptIn?: boolean; waOptIn?: boolean } = {};

  if ("phone" in body) {
    const p = typeof body.phone === "string" ? body.phone.trim().slice(0, 20) : null;
    data.phone = p || null;
  }
  if (typeof body.smsOptIn === "boolean") data.smsOptIn = body.smsOptIn;
  if (typeof body.waOptIn  === "boolean") data.waOptIn  = body.waOptIn;

  const user = await db.user.update({
    where: { id: session.user.id },
    data,
    select: { phone: true, smsOptIn: true, waOptIn: true },
  });

  return NextResponse.json(user);
});
