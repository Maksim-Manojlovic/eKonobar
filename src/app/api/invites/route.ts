import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    if (session.user.role === "VENUE_OWNER") {
      const invites = await db.invite.findMany({
        where: { senderId: session.user.id, type: "JOB_INVITE" },
        include: {
          recipient: { select: { id: true, name: true, verificationTier: true } },
        },
        orderBy: { createdAt: "desc" },
      });
      return NextResponse.json(invites);
    }

    if (session.user.role === "WAITER") {
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

    return NextResponse.json([]);
  } catch (err) {
    console.error("[GET /api/invites]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "VENUE_OWNER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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

  try {
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
  } catch (err) {
    console.error("[POST /api/invites]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
