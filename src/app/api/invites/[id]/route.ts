import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "WAITER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const invite = await db.invite.findFirst({
    where: { id, recipientId: session.user.id, type: "JOB_INVITE" },
  });
  if (!invite) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (invite.status !== "PENDING") {
    return NextResponse.json({ error: "Already responded" }, { status: 400 });
  }

  const body = await req.json();
  const { status } = body;

  if (status !== "ACCEPTED" && status !== "DECLINED") {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  try {
    const updated = await db.invite.update({
      where: { id },
      data: {
        status,
        usedAt: status === "ACCEPTED" ? new Date() : undefined,
      },
    });
    return NextResponse.json(updated);
  } catch (err) {
    console.error("[PATCH /api/invites/[id]]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
