import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/with-role";
import { dbRaw } from "@/lib/core/db";

export const GET = withAuth(async (_req, _ctx, session) => {
  const userId = session.user.id;

  const [
    user,
    passport,
    engagements,
    applications,
    reviewsAuthored,
    reviewsReceived,
    notifications,
    invitesSent,
    invitesReceived,
    shiftAssignments,
    payments,
  ] = await Promise.all([
    dbRaw.user.findUnique({
      where: { id: userId },
      select: {
        id: true, email: true, name: true, role: true,
        verificationTier: true, phone: true, smsOptIn: true,
        waOptIn: true, createdAt: true, updatedAt: true,
      },
    }),
    dbRaw.waiterPassport.findUnique({
      where: { userId },
      select: {
        bio: true, skills: true, languages: true, yearsExperience: true,
        score: true, totalEngagements: true, currentlyAvailable: true,
        sanitaryBookValid: true, sanitaryExpiry: true,
        createdAt: true, updatedAt: true,
      },
    }),
    dbRaw.engagementRecord.findMany({
      where: { waiterId: userId },
      select: {
        id: true, engagementType: true, startDate: true,
        endDate: true, verified: true, createdAt: true,
        venue: { select: { name: true, municipality: true } },
      },
      orderBy: { startDate: "desc" },
    }),
    dbRaw.jobApplication.findMany({
      where: { waiterId: userId },
      select: {
        id: true, status: true, appliedAt: true, updatedAt: true,
        jobPost: { select: { title: true, venue: { select: { name: true } } } },
      },
      orderBy: { appliedAt: "desc" },
    }),
    dbRaw.review.findMany({
      where: { authorId: userId },
      select: {
        id: true, direction: true, status: true, comment: true,
        overallRating: true, createdAt: true,
        venue: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    dbRaw.review.findMany({
      where: { subjectId: userId },
      select: {
        id: true, direction: true, status: true, comment: true,
        overallRating: true, createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    }),
    dbRaw.notification.findMany({
      where: { userId },
      select: {
        id: true, type: true, title: true, body: true,
        link: true, read: true, createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 500,
    }),
    dbRaw.invite.findMany({
      where: { senderId: userId },
      select: {
        id: true, type: true, status: true, message: true,
        createdAt: true, expiresAt: true,
        recipient: { select: { name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    dbRaw.invite.findMany({
      where: { recipientId: userId },
      select: {
        id: true, type: true, status: true, message: true,
        createdAt: true, expiresAt: true,
        sender: { select: { name: true } },
        venueId: true,
      },
      orderBy: { createdAt: "desc" },
    }),
    dbRaw.shiftAssignment.findMany({
      where: { waiterId: userId },
      select: {
        id: true, clockInAt: true, clockOutAt: true, clockInMethod: true,
        lateMinutes: true, earlyExitAt: true,
        shift: {
          select: {
            date: true, scheduledStart: true, startTime: true, endTime: true,
            role: true, venue: { select: { name: true } },
          },
        },
      },
      orderBy: { shift: { scheduledStart: "desc" } },
      take: 500,
    }),
    dbRaw.passportPayment.findMany({
      where: { userId },
      select: {
        id: true, orderNumber: true, tier: true, amountRsd: true,
        status: true, createdAt: true, updatedAt: true,
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const payload = {
    exportedAt:      new Date().toISOString(),
    profile:         user,
    passport:        passport ?? null,
    engagements,
    jobApplications: applications,
    reviewsAuthored,
    reviewsReceived,
    notifications,
    invitesSent,
    invitesReceived,
    shiftAssignments,
    payments,
  };

  return new NextResponse(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      "Content-Type":        "application/json",
      "Content-Disposition": `attachment; filename="ekonobar-export-${userId}.json"`,
    },
  });
});
