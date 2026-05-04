import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { dbRaw } from "@/lib/db";
import { ApplicationStatus } from "@prisma/client";
import { syncPassportScore } from "@/lib/sync-scores";

// Valid transitions per role
const VENUE_TRANSITIONS: Partial<Record<ApplicationStatus, ApplicationStatus[]>> = {
  PENDING:     ["SHORTLISTED", "ACCEPTED", "REJECTED"],
  SHORTLISTED: ["ACCEPTED", "REJECTED"],
  ACCEPTED:    ["COMPLETED", "REJECTED"],
};

const WAITER_TRANSITIONS: Partial<Record<ApplicationStatus, ApplicationStatus[]>> = {
  PENDING:     ["WITHDRAWN"],
  SHORTLISTED: ["WITHDRAWN"],
};

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
    include: {
      jobPost: {
        select: {
          ownerId: true,
          venueId: true,
          engagementType: true,
          startDate: true,
          endDate: true,
        },
      },
    },
  });

  if (!application) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isOwner  = application.jobPost.ownerId === session.user.id;
  const isWaiter = application.waiterId === session.user.id;

  if (!isOwner && !isWaiter) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // State machine validation
  const current = application.status as ApplicationStatus;
  const allowed = isOwner
    ? VENUE_TRANSITIONS[current] ?? []
    : WAITER_TRANSITIONS[current] ?? [];

  if (!allowed.includes(status)) {
    return NextResponse.json(
      { error: `Cannot transition from ${current} to ${status}` },
      { status: 400 }
    );
  }

  const updated = await db.jobApplication.update({
    where: { id },
    data: { status },
  });

  // COMPLETED side-effects: create engagement record + update passport
  if (status === "COMPLETED") {
    const { venueId, engagementType, startDate, endDate } = application.jobPost;
    const waiterId = application.waiterId;
    const now = new Date();

    await dbRaw.$transaction([
      dbRaw.engagementRecord.create({
        data: {
          waiterId,
          venueId,
          jobPostId: application.jobPostId,
          engagementType,
          startDate: startDate ?? now,
          endDate:   endDate   ?? now,
          verified:  true,
          verifiedAt: now,
        },
      }),
      dbRaw.waiterPassport.updateMany({
        where: { userId: waiterId },
        data:  { totalEngagements: { increment: 1 } },
      }),
    ]);

    // Fire-and-forget score recalc
    syncPassportScore(waiterId).catch(console.error);
  }

  return NextResponse.json(updated);
}
