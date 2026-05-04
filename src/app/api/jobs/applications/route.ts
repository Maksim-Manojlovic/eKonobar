import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { checkRateLimit } from "@/lib/rate-limit";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (session.user.role === "WAITER") {
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

  if (session.user.role === "VENUE_OWNER") {
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

  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "WAITER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const allowed = await checkRateLimit(session.user.id, "apply_job", 10);
  if (!allowed) {
    return NextResponse.json({ error: "Previše prijava. Pokušaj ponovo za sat vremena." }, { status: 429 });
  }

  const body = await req.json();
  const { jobPostId, coverNote } = body;

  if (!jobPostId) {
    return NextResponse.json({ error: "jobPostId is required" }, { status: 400 });
  }

  const post = await db.jobPost.findFirst({ where: { id: jobPostId, status: "ACTIVE" } });
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

  return NextResponse.json(application, { status: 201 });
}
