import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const venue = await db.venue.findUnique({
    where: { id },
    include: {
      venueTrustScore: true,
      _count: { select: { jobPosts: true, reviews: true } },
      jobPosts: {
        where: { status: "ACTIVE" },
        select: {
          id: true,
          title: true,
          engagementType: true,
          salaryMin: true,
          salaryMax: true,
          tipSystem: true,
          sanitaryRequired: true,
          redAlert: true,
          redAlertNote: true,
          startDate: true,
          _count: { select: { applications: true } },
        },
        orderBy: [{ redAlert: "desc" }, { createdAt: "desc" }],
        take: 10,
      },
      zones: {
        select: { zone: { select: { name: true, zoneType: true, projectedGrowthPercent: true, operatorTip: true } } },
      },
    },
  });

  if (!venue) {
    return NextResponse.json({ error: "Lokal nije pronađen" }, { status: 404 });
  }

  // Fetch recent published reviews separately (exclude private fields)
  const reviews = await db.review.findMany({
    where: { venueId: id, direction: "WAITER_TO_VENUE", status: "PUBLISHED" },
    select: {
      id: true,
      overallRating: true,
      comment: true,
      publishedAt: true,
      ratingAtmosphere: true,
      ratingOrganization: true,
      ratingPay: true,
      ratingTips: true,
      ratingHygieneWork: true,
      ratingManagement: true,
      author: { select: { name: true, verificationTier: true } },
    },
    orderBy: { publishedAt: "desc" },
    take: 20,
  });

  return NextResponse.json({ ...venue, recentReviews: reviews });
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
  const { images, logo, phone, website, instagram, description, capacity, priceRangeMin, priceRangeMax, geofenceEnabled } =
    body as {
      images?: string[];
      logo?: string | null;
      phone?: string | null;
      website?: string | null;
      instagram?: string | null;
      description?: string | null;
      capacity?: number | null;
      priceRangeMin?: number | null;
      priceRangeMax?: number | null;
      geofenceEnabled?: boolean;
    };

  if (images !== undefined) {
    if (!Array.isArray(images)) {
      return NextResponse.json({ error: "images must be an array" }, { status: 400 });
    }
    if (images.length > 8) {
      return NextResponse.json({ error: "Maksimalno 8 slika" }, { status: 400 });
    }
  }

  if (website) {
    try {
      const u = new URL(website);
      if (u.protocol !== "http:" && u.protocol !== "https:") throw new Error();
    } catch {
      return NextResponse.json({ error: "website mora biti http/https URL" }, { status: 400 });
    }
  }

  // instagram can be a bare handle or URL — only reject dangerous schemes
  if (instagram && /^(javascript|data|vbscript):/i.test(instagram.trim())) {
    return NextResponse.json({ error: "Nevažeći instagram unos" }, { status: 400 });
  }

  const venue = await db.venue.findUnique({ where: { id }, select: { ownerId: true } });
  if (!venue) return NextResponse.json({ error: "Lokal nije pronađen" }, { status: 404 });
  if (venue.ownerId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const updated = await db.venue.update({
    where: { id },
    data: {
      ...(images !== undefined && { images }),
      ...(logo !== undefined && { logo: logo || null }),
      ...(phone !== undefined && { phone: phone || null }),
      ...(website !== undefined && { website: website || null }),
      ...(instagram !== undefined && { instagram: instagram || null }),
      ...(description !== undefined && { description: description || null }),
      ...(capacity !== undefined && { capacity: capacity != null ? Number(capacity) : null }),
      ...(priceRangeMin !== undefined && { priceRangeMin: priceRangeMin != null ? Number(priceRangeMin) : null }),
      ...(priceRangeMax !== undefined && { priceRangeMax: priceRangeMax != null ? Number(priceRangeMax) : null }),
      ...(geofenceEnabled !== undefined && { geofenceEnabled: Boolean(geofenceEnabled) }),
    },
  });

  return NextResponse.json(updated);
}
