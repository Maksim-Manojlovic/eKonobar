import { NextResponse } from "next/server";
import { withAuth } from "@/lib/with-role";
import { db } from "@/lib/db";

const ALLOWED: string[] = ["WAITER", "VENUE_OWNER", "HEADHUNTER"];

export const PATCH = withAuth(async (req, _ctx, session) => {
  const { role } = await req.json();
  if (!role || !ALLOWED.includes(role)) {
    return NextResponse.json({ error: "Nevažeća uloga." }, { status: 400 });
  }

  await db.user.update({
    where: { id: session.user.id },
    data:  { role },
  });

  return NextResponse.json({ ok: true, role });
});
