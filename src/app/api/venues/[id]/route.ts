import { NextRequest, NextResponse } from "next/server";
import { withRole } from "@/lib/auth/with-role";
import { db } from "@/lib/core/db";
import { parseBody } from "@/lib/auth/parse-body";
import { z } from "zod";

const VenuePatchSchema = z.object({
  images:        z.array(z.string()).max(8).optional(),
  logo:          z.string().nullish(),
  phone:         z.string().nullish(),
  website:       z.string().nullish(),
  instagram:     z.string().nullish(),
  description:   z.string().nullish(),
  capacity:      z.number().int().positive().nullish(),
  priceRangeMin: z.number().min(0).nullish(),
  priceRangeMax: z.number().min(0).nullish(),
  geofenceEnabled: z.boolean().optional(),
  isActive:      z.boolean().optional(),
});

type Ctx = { params: Promise<{ id: string }> };

// GET — public (no auth required)
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

  const reviewSelect = {
    id: true,
    overallRating: true,
    comment: true,
    publishedAt: true,
    author: { select: { name: true, verificationTier: true } },
  } as const;

  // Fetch both waiter and guest published reviews
  const [waiterReviews, guestReviews] = await Promise.all([
    db.review.findMany({
      where: { venueId: id, direction: "WAITER_TO_VENUE", status: "PUBLISHED" },
      select: {
        ...reviewSelect,
        ratingAtmosphere: true,
        ratingOrganization: true,
        ratingPay: true,
        ratingTips: true,
        ratingHygieneWork: true,
        ratingManagement: true,
      },
      orderBy: { publishedAt: "desc" },
      take: 20,
    }),
    db.review.findMany({
      where: { venueId: id, direction: "GUEST_TO_VENUE", status: "PUBLISHED" },
      select: {
        ...reviewSelect,
        guestHandle: true,
        ratingAtmosphere: true,
        ratingOrganization: true,
        ratingHygieneWork: true,
      },
      orderBy: { publishedAt: "desc" },
      take: 20,
    }),
  ]);

  return NextResponse.json({ ...venue, waiterReviews, guestReviews });
}

// PATCH — venue owner only
export const PATCH = withRole<Ctx>("VENUE_OWNER", async (req, ctx, session) => {
  const { id } = await ctx.params;
  const parsed = await parseBody(VenuePatchSchema, req);
  if (!parsed.ok) return parsed.response;
  const { images, logo, phone, website, instagram, description, capacity, priceRangeMin, priceRangeMax, geofenceEnabled, isActive } = parsed.data;

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
      ...(capacity !== undefined && { capacity: capacity ?? null }),
      ...(priceRangeMin !== undefined && { priceRangeMin: priceRangeMin ?? null }),
      ...(priceRangeMax !== undefined && { priceRangeMax: priceRangeMax ?? null }),
      ...(geofenceEnabled !== undefined && { geofenceEnabled }),
      ...(isActive !== undefined && { isActive }),
    },
  });

  return NextResponse.json(updated);
});
