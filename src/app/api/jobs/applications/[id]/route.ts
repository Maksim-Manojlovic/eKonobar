import { NextResponse } from "next/server";
import { withAuth } from "@/lib/with-role";
import { db } from "@/lib/db";
import { dbRaw } from "@/lib/db";
import { ApplicationStatus } from "@prisma/client";
import { syncPassportScore } from "@/lib/sync-scores";
import { notify } from "@/lib/notify";

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

export const PATCH = withAuth<{ params: Promise<{ id: string }> }>(async (req, ctx, session) => {
  const { id } = await ctx.params;
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
          title: true,
          ownerId: true,
          venueId: true,
          engagementType: true,
          startDate: true,
          endDate: true,
          venue: { select: { name: true } },
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

  // Notify waiter about status change
  const statusMessages: Partial<Record<ApplicationStatus, string>> = {
    ACCEPTED:    `Čestitamo! Prijava za "${application.jobPost.title}" je prihvaćena.`,
    REJECTED:    `Prijava za "${application.jobPost.title}" nije prihvaćena.`,
    SHORTLISTED: `Ušli ste u uži izbor za "${application.jobPost.title}".`,
    COMPLETED:   `Angažman u lokalu "${application.jobPost.venue?.name}" je završen.`,
  };
  const msg = statusMessages[status];
  if (msg && isOwner) {
    notify(application.waiterId, "APPLICATION_STATUS_CHANGED", "Prijava ažurirana", msg, `/dashboard/waiter`).catch(console.error);
  }

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
});
