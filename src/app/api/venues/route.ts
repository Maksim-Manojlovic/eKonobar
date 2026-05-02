import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { VenueType } from "@prisma/client";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (session.user.role === "VENUE_OWNER") {
    const venues = await db.venue.findMany({
      where: { ownerId: session.user.id },
      include: {
        _count: { select: { jobPosts: true } },
        venueTrustScore: true,
      },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(venues);
  }

  // Other roles: return all active venues (for map / browse)
  const venues = await db.venue.findMany({
    where: { isActive: true },
    select: {
      id: true, name: true, address: true, municipality: true,
      venueType: true, latitude: true, longitude: true, trustScore: true,
    },
    orderBy: { trustScore: "desc" },
  });
  return NextResponse.json(venues);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "VENUE_OWNER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { name, address, municipality, venueType, latitude, longitude, capacity, description, phone, website, instagram } = body;

  if (!name || !address || !municipality || !venueType || latitude == null || longitude == null) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  if (!Object.values(VenueType).includes(venueType)) {
    return NextResponse.json({ error: "Invalid venueType" }, { status: 400 });
  }

  const venue = await db.venue.create({
    data: {
      ownerId: session.user.id,
      name,
      address,
      municipality,
      venueType,
      latitude: Number(latitude),
      longitude: Number(longitude),
      capacity: capacity ? Number(capacity) : undefined,
      description: description ?? undefined,
      phone: phone ?? undefined,
      website: website ?? undefined,
      instagram: instagram ?? undefined,
    },
  });

  return NextResponse.json(venue, { status: 201 });
}
