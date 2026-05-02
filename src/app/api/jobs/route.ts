import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { EngagementType, TipSystem } from "@prisma/client";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const { searchParams } = new URL(req.url);

  // Venue owner sees only their own posts (all statuses)
  if (session?.user.role === "VENUE_OWNER") {
    const posts = await db.jobPost.findMany({
      where: { ownerId: session.user.id },
      include: {
        venue: { select: { id: true, name: true, address: true, municipality: true } },
        _count: { select: { applications: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(posts);
  }

  // Everyone else (waiters, guests): active posts with optional filters
  const redAlert   = searchParams.get("redAlert") === "true" ? true : undefined;
  const type       = searchParams.get("type") as EngagementType | null;
  const search     = searchParams.get("search") ?? undefined;

  const posts = await db.jobPost.findMany({
    where: {
      status: "ACTIVE",
      ...(redAlert !== undefined && { redAlert }),
      ...(type && Object.values(EngagementType).includes(type) && { engagementType: type }),
      ...(search && {
        OR: [
          { title: { contains: search, mode: "insensitive" } },
          { description: { contains: search, mode: "insensitive" } },
        ],
      }),
    },
    include: {
      venue: {
        select: { id: true, name: true, address: true, municipality: true, latitude: true, longitude: true, trustScore: true },
      },
      _count: { select: { applications: true } },
    },
    orderBy: [{ redAlert: "desc" }, { createdAt: "desc" }],
    take: 50,
  });

  return NextResponse.json(posts);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "VENUE_OWNER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const {
    venueId, title, description, engagementType, tipSystem,
    salaryMin, salaryMax, sanitaryRequired, redAlert, redAlertNote,
    startDate, endDate, applicationDeadline,
  } = body;

  if (!venueId || !title || !description || !engagementType || !tipSystem) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  if (!Object.values(EngagementType).includes(engagementType)) {
    return NextResponse.json({ error: "Invalid engagementType" }, { status: 400 });
  }
  if (!Object.values(TipSystem).includes(tipSystem)) {
    return NextResponse.json({ error: "Invalid tipSystem" }, { status: 400 });
  }

  // Verify the venue belongs to this owner
  const venue = await db.venue.findFirst({ where: { id: venueId, ownerId: session.user.id } });
  if (!venue) return NextResponse.json({ error: "Venue not found" }, { status: 404 });

  const post = await db.jobPost.create({
    data: {
      venueId,
      ownerId: session.user.id,
      title,
      description,
      engagementType,
      tipSystem,
      salaryMin: salaryMin ? Number(salaryMin) : undefined,
      salaryMax: salaryMax ? Number(salaryMax) : undefined,
      sanitaryRequired: sanitaryRequired ?? false,
      redAlert: redAlert ?? false,
      redAlertNote: redAlertNote ?? undefined,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      applicationDeadline: applicationDeadline ? new Date(applicationDeadline) : undefined,
    },
    include: {
      venue: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json(post, { status: 201 });
}
