import { NextResponse } from "next/server";
import { withAuth, withRole } from "@/lib/with-role";
import { db } from "@/lib/db";
import { checkRateLimit } from "@/lib/rate-limit";
import type { Session } from "next-auth";

// ── GET ───────────────────────────────────────────────────────────────────────

export const GET = withAuth(async (_req, _ctx, session) => {
  if (session.user.role === "VENUE_OWNER") return getSentInvites(session);
  if (session.user.role === "WAITER")      return getReceivedInvites(session);
  return NextResponse.json([]);
});

async function getSentInvites(session: Session) {
  const invites = await db.invite.findMany({
    where: { senderId: session.user.id, type: "JOB_INVITE" },
    include: {
      recipient: { select: { id: true, name: true, verificationTier: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(invites);
}

async function getReceivedInvites(session: Session) {
  const invites = await db.invite.findMany({
    where: { recipientId: session.user.id, type: "JOB_INVITE" },
    include: {
      sender: {
        select: {
          id: true,
          name: true,
          venues: { select: { id: true, name: true }, take: 1 },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(invites);
}

// ── POST ──────────────────────────────────────────────────────────────────────

export const POST = withRole("VENUE_OWNER", async (req, _ctx, session) => {
  const allowed = await checkRateLimit(session.user.id, "post_invite", 20);
  if (!allowed) {
    return NextResponse.json({ error: "Previše pozivnica. Pokušaj ponovo za sat vremena." }, { status: 429 });
  }

  const body = await req.json();
  const { waiterId, jobPostId, message } = body;

  if (!waiterId) {
    return NextResponse.json({ error: "waiterId required" }, { status: 400 });
  }

  const waiter = await db.user.findFirst({ where: { id: waiterId, role: "WAITER" } });
  if (!waiter) return NextResponse.json({ error: "Waiter not found" }, { status: 404 });

  let venueId: string | undefined;
  if (jobPostId) {
    const jobPost = await db.jobPost.findFirst({
      where: { id: jobPostId, ownerId: session.user.id },
      include: { venue: { select: { id: true } } },
    });
    if (!jobPost) return NextResponse.json({ error: "Job post not found" }, { status: 404 });
    venueId = jobPost.venue.id;
  } else {
    // Use first venue belonging to this owner
    const venue = await db.venue.findFirst({ where: { ownerId: session.user.id }, select: { id: true } });
    venueId = venue?.id;
  }

  const existing = await db.invite.findFirst({
    where: { senderId: session.user.id, recipientId: waiterId, type: "JOB_INVITE", status: "PENDING" },
  });
  if (existing) return NextResponse.json({ error: "Invite already sent" }, { status: 409 });

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  const invite = await db.invite.create({
    data: {
      senderId: session.user.id,
      recipientId: waiterId,
      venueId: venueId ?? null,
      jobPostId: jobPostId ?? null,
      type: "JOB_INVITE",
      status: "PENDING",
      message: message || undefined,
      expiresAt,
    },
  });
  return NextResponse.json(invite, { status: 201 });
});
