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
