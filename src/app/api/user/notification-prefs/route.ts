import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { phone: true, smsOptIn: true, waOptIn: true },
  });

  return NextResponse.json(user ?? { phone: null, smsOptIn: false, waOptIn: false });
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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
}
