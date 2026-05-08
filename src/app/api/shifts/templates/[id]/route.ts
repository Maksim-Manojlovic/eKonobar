import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { getManagedTemplate } from "@/lib/shift-auth";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user.role !== "VENUE_OWNER" && session.user.role !== "WAITER")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const existing = await getManagedTemplate(id, session.user.id, session.user.role);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const { name, dayOfWeek, weekdaysOnly, metadata, startTime, endTime, requiredCount, role, pay } = body;

  const template = await db.shiftTemplate.update({
    where: { id },
    data: {
      ...(name !== undefined && { name }),
      ...(weekdaysOnly !== undefined && { weekdaysOnly: Boolean(weekdaysOnly) }),
      ...(dayOfWeek !== undefined && { dayOfWeek: dayOfWeek === null ? null : Number(dayOfWeek) }),
      ...(metadata !== undefined && { metadata: metadata ?? null }),
      ...(startTime !== undefined && { startTime }),
      ...(endTime !== undefined && { endTime }),
      ...(requiredCount !== undefined && { requiredCount: Math.max(1, Number(requiredCount)) }),
      role: role !== undefined ? (role || null) : undefined,
      pay: pay !== undefined ? (pay ? Math.round(Number(pay)) : null) : undefined,
    },
  });

  return NextResponse.json(template);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user.role !== "VENUE_OWNER" && session.user.role !== "WAITER")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const existing = await getManagedTemplate(id, session.user.id, session.user.role);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.shiftTemplate.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
