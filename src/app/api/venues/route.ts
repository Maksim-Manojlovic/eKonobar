import { NextResponse } from "next/server";
import { withOptionalAuth, withRole } from "@/lib/auth/with-role";
import { db } from "@/lib/core/db";
import { VenueType } from "@prisma/client";
import { parseBody } from "@/lib/auth/parse-body";
import { z } from "zod";

const VenueCreateSchema = z.object({
  name:         z.string().min(1),
  address:      z.string().min(1),
  municipality: z.string().min(1),
  venueType:    z.nativeEnum(VenueType),
  latitude:     z.number(),
  longitude:    z.number(),
  capacity:     z.number().int().positive().nullish(),
  description:  z.string().nullish(),
  phone:        z.string().nullish(),
  website:      z.string().nullish(),
  instagram:    z.string().nullish(),
});

export const GET = withOptionalAuth(async (_req, _ctx, session) => {
  if (session?.user.role === "VENUE_OWNER") {
    const venues = await db.venue.findMany({
      where: { ownerId: session.user.id },
      include: {
        _count: { select: { jobPosts: true } },
        venueTrustScore: true,
        headWaiter: { select: { id: true, name: true } },
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
});

export const POST = withRole("VENUE_OWNER", async (req, _ctx, session) => {
  const parsed = await parseBody(VenueCreateSchema, req);
  if (!parsed.ok) return parsed.response;
  const { name, address, municipality, venueType, latitude, longitude, capacity, description, phone, website, instagram } = parsed.data;

  const venue = await db.venue.create({
    data: {
      ownerId: session.user.id,
      name,
      address,
      municipality,
      venueType,
      latitude,
      longitude,
      capacity:    capacity    ?? undefined,
      description: description ?? undefined,
      phone:       phone       ?? undefined,
      website:     website     ?? undefined,
      instagram:   instagram   ?? undefined,
    },
  });

  return NextResponse.json(venue, { status: 201 });
});
