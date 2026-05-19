import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { dbRaw } from "@/lib/db";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  // Prevent self-modification
  if (id === session.user.id) {
    return NextResponse.json({ error: "Cannot modify own account" }, { status: 400 });
  }

  const body = await req.json();
  const data: Record<string, unknown> = {};

  if (body.role && ["WAITER", "VENUE_OWNER", "HEADHUNTER", "ADMIN"].includes(body.role)) {
    data.role = body.role;
  }

  if (body.action === "delete") {
    data.deletedAt = new Date();
  }

  if (body.action === "restore") {
    data.deletedAt = null;
  }

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

  return NextResponse.json(user);
}
