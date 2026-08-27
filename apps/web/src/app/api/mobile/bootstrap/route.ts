import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/with-role";
import { db } from "@/lib/core/db";

/**
 * GET /api/mobile/bootstrap — one round trip for a cold start.
 *
 * The app previously opened with six to eight parallel requests before it could
 * draw anything: who am I, my venue, my passport, unread count, today's shifts,
 * whatever the home screen counts. On a phone that is six to eight TLS-warm
 * round trips over a cellular link, and the screen is blank until the slowest
 * one lands.
 *
 * This returns only what the home screen needs to render *and decide what to
 * fetch next* — not a copy of every list. The lists still come from their own
 * endpoints once the shell is up, which keeps this response a fixed small size
 * no matter how much data an account has accumulated.
 *
 * Deliberately not cached. It is per-user, cheap, and its whole job is to be
 * correct at the moment the app opens; a stale unread badge is exactly the kind
 * of thing users notice.
 */

type WaiterBootstrap = {
  passport: {
    score: number;
    currentlyAvailable: boolean;
    sanitaryBookValid: boolean;
    profilePhoto: string | null;
  } | null;
  /** Shifts assigned to this waiter that have not finished yet. */
  upcomingShifts: number;
  /** Invites still awaiting an answer. */
  pendingInvites: number;
  /** Rosters this waiter is on — zero means the Odmori screen has nothing to show. */
  staffRosters: number;
};

type OwnerBootstrap = {
  venue: {
    id: string;
    name: string;
    municipality: string | null;
    trustScore: number | null;
    isActive: boolean;
    logo: string | null;
  } | null;
  activePosts: number;
  pendingApplications: number;
  pendingClockIns: number;
  pendingLeaveRequests: number;
};

type AdminBootstrap = {
  pendingSanitary: number;
  disputedReviews: number;
};

export const GET = withAuth(async (_req, _ctx, session) => {
  const { id: userId, role } = session.user;

  const unreadNotifications = await db.notification.count({
    where: { userId, read: false },
  });

  const base = { user: session.user, unreadNotifications };

  if (role === "VENUE_OWNER") {
    return NextResponse.json({ ...base, owner: await ownerBootstrap(userId) });
  }
  if (role === "ADMIN") {
    return NextResponse.json({ ...base, admin: await adminBootstrap() });
  }
  return NextResponse.json({ ...base, waiter: await waiterBootstrap(userId) });
});

async function waiterBootstrap(userId: string): Promise<WaiterBootstrap> {
  const now = new Date();

  const [passport, upcomingShifts, pendingInvites, staffRosters] = await Promise.all([
    db.waiterPassport.findUnique({
      where: { userId },
      select: {
        score: true,
        currentlyAvailable: true,
        sanitaryBookValid: true,
        profilePhoto: true,
      },
    }),
    // scheduledStart is nullable on older rows, so "upcoming" is scoped to
    // shifts that actually carry one — a null start cannot be in the future.
    db.shiftAssignment.count({
      where: { waiterId: userId, shift: { scheduledStart: { gte: now } } },
    }),
    db.invite.count({
      where: { recipientId: userId, status: "PENDING", expiresAt: { gt: now } },
    }),
    db.venueStaff.count({ where: { waiterId: userId, status: { not: "ENDED" } } }),
  ]);

  return { passport, upcomingShifts, pendingInvites, staffRosters };
}

async function ownerBootstrap(userId: string): Promise<OwnerBootstrap> {
  // v1 assumes one venue per owner, the same assumption the app's usePrimaryVenue
  // makes when it takes venues[0]. The ordering must therefore match GET
  // /api/venues exactly — createdAt desc — or an owner with two venues gets a
  // home screen counting one venue and a Profil tab showing the other.
  const venue = await db.venue.findFirst({
    where: { ownerId: userId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true, name: true, municipality: true,
      trustScore: true, isActive: true, logo: true,
    },
  });

  if (!venue) {
    return {
      venue: null,
      activePosts: 0,
      pendingApplications: 0,
      pendingClockIns: 0,
      pendingLeaveRequests: 0,
    };
  }

  const [activePosts, pendingApplications, pendingClockIns, pendingLeaveRequests] =
    await Promise.all([
      db.jobPost.count({ where: { ownerId: userId, status: "ACTIVE" } }),
      db.jobApplication.count({
        where: { status: "PENDING", jobPost: { ownerId: userId } },
      }),
      db.shiftAssignment.count({
        where: { pendingClockIn: true, shift: { venueId: venue.id } },
      }),
      db.leaveRequest.count({ where: { venueId: venue.id, status: "PENDING" } }),
    ]);

  return { venue, activePosts, pendingApplications, pendingClockIns, pendingLeaveRequests };
}

async function adminBootstrap(): Promise<AdminBootstrap> {
  const [pendingSanitary, disputedReviews] = await Promise.all([
    db.sanitaryBook.count({ where: { status: "PENDING" } }),
    db.review.count({ where: { status: "DISPUTED" } }),
  ]);

  return { pendingSanitary, disputedReviews };
}
