import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await getServerSession(authOptions);

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
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "VENUE_OWNER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
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
}
