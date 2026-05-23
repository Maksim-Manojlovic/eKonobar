import { NextResponse } from "next/server";
import { withOptionalAuth, withRole } from "@/lib/with-role";
import { db } from "@/lib/db";

type Ctx = { params: Promise<{ id: string }> };

export const GET = withOptionalAuth<Ctx>(async (_req, ctx, session) => {
  const { id } = await ctx.params;

  const job = await db.jobPost.findUnique({
    where: { id },
    include: {
      venue: {
        select: {
          id: true,
          name: true,
          address: true,
          municipality: true,
          venueType: true,
          latitude: true,
          longitude: true,
          trustScore: true,
          phone: true,
          website: true,
          instagram: true,
          venueTrustScore: true,
        },
      },
      _count: { select: { applications: true } },
    },
  });

  if (!job || job.status === "DELETED") {
    return NextResponse.json({ error: "Oglas nije pronađen" }, { status: 404 });
  }

  // Check if the current user has already applied
  let hasApplied = false;
  if (session?.user.role === "WAITER") {
    const existing = await db.jobApplication.findUnique({
      where: { jobPostId_waiterId: { jobPostId: id, waiterId: session.user.id } },
      select: { id: true, status: true },
    });
    if (existing) hasApplied = true;
  }

  return NextResponse.json({ ...job, hasApplied });
});

export const PATCH = withRole<Ctx>("VENUE_OWNER", async (req, ctx, session) => {
  const { id } = await ctx.params;
  const body = await req.json();
  const { status } = body as { status?: string };

  const ALLOWED: Record<string, string> = { ACTIVE: "PAUSED", PAUSED: "ACTIVE" };
  if (!status || !ALLOWED[status]) {
    return NextResponse.json({ error: "status must be ACTIVE or PAUSED" }, { status: 400 });
  }

  const post = await db.jobPost.findUnique({
    where: { id },
    select: { ownerId: true, status: true },
  });

  if (!post || post.status === "DELETED") {
    return NextResponse.json({ error: "Oglas nije pronađen" }, { status: 404 });
  }
  if (post.ownerId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (post.status === status) {
    return NextResponse.json({ error: "Oglas već ima ovaj status" }, { status: 409 });
  }
  if (!ALLOWED[post.status as string]) {
    return NextResponse.json({ error: `Cannot change status from ${post.status}` }, { status: 400 });
  }

  const updated = await db.jobPost.update({
    where: { id },
    data: { status: status as "ACTIVE" | "PAUSED" },
    select: { id: true, status: true },
  });

  return NextResponse.json(updated);
});
