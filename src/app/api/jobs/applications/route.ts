import { NextResponse } from "next/server";
import { withAuth, withRole } from "@/lib/auth/with-role";
import { db } from "@/lib/core/db";
import logger from "@/lib/core/logger";
import { checkRateLimit } from "@/lib/core/rate-limit";
import { fireSideEffects } from "@/lib/notifications/side-effects";
import type { Session } from "next-auth";
import { parseBody } from "@/lib/auth/parse-body";
import { z } from "zod";

const ApplicationPostSchema = z.object({
  jobPostId: z.string().min(1),
  coverNote: z.string().max(1000).nullish(),
});

// ── GET ───────────────────────────────────────────────────────────────────────

export const GET = withAuth(async (_req, _ctx, session) => {
  if (session.user.role === "WAITER")      return getWaiterApplications(session);
  if (session.user.role === "VENUE_OWNER") return getOwnerApplications(session);
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
});

async function getWaiterApplications(session: Session) {
  const applications = await db.jobApplication.findMany({
    where: { waiterId: session.user.id },
    include: {
      jobPost: {
        include: {
          venue: { select: { id: true, name: true, address: true, municipality: true } },
        },
      },
    },
    orderBy: { appliedAt: "desc" },
  });
  return NextResponse.json(applications);
}

async function getOwnerApplications(session: Session) {
  const applications = await db.jobApplication.findMany({
    where: { jobPost: { ownerId: session.user.id } },
    include: {
      jobPost: { select: { id: true, title: true, venueId: true } },
      waiter: {
        select: {
          id: true, name: true, verificationTier: true,
          waiterPassport: {
            select: {
              score: true, badges: true, skills: true,
              sanitaryBookValid: true, currentlyAvailable: true,
            },
          },
        },
      },
    },
    orderBy: { appliedAt: "desc" },
  });
  return NextResponse.json(applications);
}

// ── POST ──────────────────────────────────────────────────────────────────────

export const POST = withRole("WAITER", async (req, _ctx, session) => {
  const allowed = await checkRateLimit(session.user.id, "apply_job", 10);
  if (!allowed) {
    return NextResponse.json({ error: "Previše prijava. Pokušaj ponovo za sat vremena." }, { status: 429 });
  }

  const parsed = await parseBody(ApplicationPostSchema, req);
  if (!parsed.ok) return parsed.response;
  const { jobPostId, coverNote } = parsed.data;

  const post = await db.jobPost.findFirst({
    where: { id: jobPostId, status: "ACTIVE" },
    include: { venue: { select: { ownerId: true, name: true } } },
  });
  if (!post) {
    return NextResponse.json({ error: "Job post not found or not active" }, { status: 404 });
  }

  // Duplicate check — @@unique([jobPostId, waiterId]) in schema
  const existing = await db.jobApplication.findUnique({
    where: { jobPostId_waiterId: { jobPostId, waiterId: session.user.id } },
  });
  if (existing) {
    return NextResponse.json({ error: "Already applied" }, { status: 409 });
  }

  const application = await db.jobApplication.create({
    data: {
      jobPostId,
      waiterId: session.user.id,
      coverNote: coverNote ?? undefined,
    },
    include: {
      jobPost: { select: { id: true, title: true } },
    },
  });

  // Notify venue owner of new application (fire-and-forget)
  fireSideEffects({
    notifications: [{
      userId: post.venue.ownerId,
      type:   "APPLICATION_RECEIVED",
      title:  "Nova prijava na oglas",
      body:   `${session.user.name ?? "Konobar"} se prijavio na "${application.jobPost.title}"`,
      link:   "/dashboard/venue",
    }],
  });

  if (post.redAlert) {
    const responseMinutes = Math.round((Date.now() - post.createdAt.getTime()) / 60_000);
    db.waiterPassport.findUnique({
      where: { userId: session.user.id },
      select: { avgRedAlertResponseMinutes: true, redAlertResponseCount: true },
    }).then(passport => {
      if (!passport) return;
      const count = passport.redAlertResponseCount;
      const oldAvg = passport.avgRedAlertResponseMinutes ?? 0;
      const newCount = count + 1;
      const newAvg = count === 0 ? responseMinutes : Math.round((oldAvg * count + responseMinutes) / newCount);
      return db.waiterPassport.update({
        where: { userId: session.user.id },
        data: { avgRedAlertResponseMinutes: newAvg, redAlertResponseCount: newCount },
      });
    }).catch((err) => logger.warn({ err }, "jobs/applications: red-alert response metric update failed"));
  }

  return NextResponse.json(application, { status: 201 });
});
