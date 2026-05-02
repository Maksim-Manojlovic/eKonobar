import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { ApplicationStatus } from "@prisma/client";

const VENUE_ALLOWED: ApplicationStatus[] = ["SHORTLISTED", "ACCEPTED", "REJECTED"];
const WAITER_ALLOWED: ApplicationStatus[] = ["WITHDRAWN"];

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const { status } = body as { status: ApplicationStatus };

  if (!status || !Object.values(ApplicationStatus).includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const application = await db.jobApplication.findUnique({
    where: { id },
    include: { jobPost: { select: { ownerId: true } } },
  });

  if (!application) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isOwner  = application.jobPost.ownerId === session.user.id;
  const isWaiter = application.waiterId === session.user.id;

  if (isOwner && !VENUE_ALLOWED.includes(status)) {
    return NextResponse.json({ error: "Invalid status transition" }, { status: 400 });
  }
  if (isWaiter && !WAITER_ALLOWED.includes(status)) {
    return NextResponse.json({ error: "Invalid status transition" }, { status: 400 });
  }
  if (!isOwner && !isWaiter) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const updated = await db.jobApplication.update({
    where: { id },
    data: { status },
  });

  return NextResponse.json(updated);
}
