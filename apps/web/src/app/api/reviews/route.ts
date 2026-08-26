import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/with-role";
import { db } from "@/lib/core/db";
import {
  isInsideVenueRadius,
  createGeolocationHash,
  parseGuestCoordinates,
} from "@/lib/geo/geofence";
import { checkRateLimit } from "@/lib/core/rate-limit";
import { fireSideEffects } from "@/lib/notifications/side-effects";
import { clampRating } from "@/lib/formatting/utils";
import { ReviewDirection } from "@prisma/client";
import { parseBody } from "@/lib/auth/parse-body";
import { z } from "zod";

const RatingDim = z.number().nullish(); // clampRating() enforces 0-100 at write time

const ReviewPostSchema = z.object({
  direction:               z.nativeEnum(ReviewDirection),
  venueId:                 z.string().optional(),
  subjectId:               z.string().optional(),
  overallRating:           z.number().min(0).max(100),
  comment:                 z.string().nullish(),
  guestLatitude:           z.number().optional(),
  guestLongitude:          z.number().optional(),
  // WAITER_TO_VENUE
  ratingAtmosphere:        RatingDim,
  ratingOrganization:      RatingDim,
  ratingPay:               RatingDim,
  ratingTips:              RatingDim,
  ratingHygieneWork:       RatingDim,
  ratingManagement:        RatingDim,
  // VENUE_TO_WAITER
  ratingPunctuality:       RatingDim,
  ratingSkill:             RatingDim,
  ratingGuestCommunication: RatingDim,
  ratingPersonalHygiene:   RatingDim,
  ratingTeamwork:          RatingDim,
  ratingSpeed:             RatingDim,
  // GUEST_TO_WAITER
  ratingFriendliness:      RatingDim,
  ratingGuestSpeed:        RatingDim,
  ratingAttentiveness:     RatingDim,
});

// GET — public, no auth needed
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const venueId   = searchParams.get("venueId")   ?? undefined;
  const subjectId = searchParams.get("subjectId") ?? undefined;
  const direction = searchParams.get("direction") as ReviewDirection | null;

  if (!venueId && !subjectId) {
    return NextResponse.json({ error: "venueId or subjectId required" }, { status: 400 });
  }

  const reviews = await db.review.findMany({
    where: {
      status: "PUBLISHED",
      ...(venueId   && { venueId }),
      ...(subjectId && { subjectId }),
      ...(direction && Object.values(ReviewDirection).includes(direction) && { direction }),
    },
    select: {
      id: true,
      direction: true,
      overallRating: true,
      comment: true,
      weight: true,
      publishedAt: true,
      createdAt: true,
      // WAITER_TO_VENUE
      ratingAtmosphere: true,
      ratingOrganization: true,
      ratingPay: true,
      ratingTips: true,
      ratingHygieneWork: true,
      ratingManagement: true,
      // VENUE_TO_WAITER
      ratingPunctuality: true,
      ratingSkill: true,
      ratingGuestCommunication: true,
      ratingPersonalHygiene: true,
      ratingTeamwork: true,
      ratingSpeed: true,
      // GUEST_TO_WAITER
      ratingFriendliness: true,
      ratingGuestSpeed: true,
      ratingAttentiveness: true,
      author: { select: { id: true, name: true, verificationTier: true } },
    },
    orderBy: { publishedAt: "desc" },
    take: 50,
  });

  return NextResponse.json(reviews);
}

export const POST = withAuth(async (req, _ctx, session) => {
  const allowed = await checkRateLimit(session.user.id, "post_review", 5);
  if (!allowed) {
    return NextResponse.json({ error: "Previše recenzija. Pokušaj ponovo za sat vremena." }, { status: 429 });
  }

  const parsed = await parseBody(ReviewPostSchema, req);
  if (!parsed.ok) return parsed.response;
  const {
    direction,
    venueId,
    subjectId,
    overallRating: rating,
    comment,
    guestLatitude,
    guestLongitude,
    ratingAtmosphere,
    ratingOrganization,
    ratingPay,
    ratingTips,
    ratingHygieneWork,
    ratingManagement,
    ratingPunctuality,
    ratingSkill,
    ratingGuestCommunication,
    ratingPersonalHygiene,
    ratingTeamwork,
    ratingSpeed,
    ratingFriendliness,
    ratingGuestSpeed,
    ratingAttentiveness,
  } = parsed.data;

  // Role validation
  if (direction === "WAITER_TO_VENUE" && session.user.role !== "WAITER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (direction === "VENUE_TO_WAITER" && session.user.role !== "VENUE_OWNER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Required target fields
  if (direction === "WAITER_TO_VENUE" && !venueId) {
    return NextResponse.json({ error: "venueId required" }, { status: 400 });
  }
  if ((direction === "VENUE_TO_WAITER" || direction === "GUEST_TO_WAITER") && !subjectId) {
    return NextResponse.json({ error: "subjectId required" }, { status: 400 });
  }

  // Resolve venue owner for WAITER_TO_VENUE notification (single query, before review create)
  let venueOwnerId: string | null = null;
  if (direction === "WAITER_TO_VENUE" && venueId) {
    const v = await db.venue.findUnique({ where: { id: venueId }, select: { ownerId: true } });
    venueOwnerId = v?.ownerId ?? null;
  }

  // Geofencing for GUEST_TO_WAITER
  let geolocationHash: string | undefined;
  let guestLat: number | undefined;
  let guestLon: number | undefined;
  const guestVenueId = venueId;

  if (direction === "GUEST_TO_WAITER") {
    if (!guestVenueId) {
      return NextResponse.json({ error: "venueId required for guest reviews" }, { status: 400 });
    }

    const venue = await db.venue.findUnique({
      where: { id: guestVenueId },
      select: { latitude: true, longitude: true, reviewRadiusKm: true, geofenceEnabled: true },
    });
    if (!venue) {
      return NextResponse.json({ error: "Lokal nije pronađen" }, { status: 404 });
    }

    const coords = parseGuestCoordinates(guestLatitude, guestLongitude);

    if (venue.geofenceEnabled) {
      if (!coords) {
        return NextResponse.json(
          { error: "Validne koordinate su obavezne za gostinsku recenziju" },
          { status: 400 },
        );
      }
      const geofence = isInsideVenueRadius(coords, venue);
      if (!geofence.allowed) {
        return NextResponse.json(
          { error: `Morate biti u lokalu da biste ostavili recenziju (${Math.round(geofence.distanceKm * 1000)}m od lokala, dozvoljeno ${Math.round(geofence.radiusKm * 1000)}m)` },
          { status: 403 },
        );
      }
    }

    if (coords) {
      guestLat = coords.lat;
      guestLon = coords.lon;
      geolocationHash = createGeolocationHash(coords.lat, coords.lon);
    }
  }

  // Weight: ID_VERIFIED authors count ×1.2
  const weight = session.user.verificationTier === "ID_VERIFIED" ? 1.2 : 1.0;

  // Pending window: guest → 2h, others → 48h
  const pendingUntil = new Date();
  pendingUntil.setHours(
    pendingUntil.getHours() + (direction === "GUEST_TO_WAITER" ? 2 : 48),
  );

  const review = await db.review.create({
    data: {
      authorId: session.user.id,
      direction,
      overallRating: rating,
      comment: comment ?? null,
      weight,
      pendingUntil,
      // Targets
      ...(direction === "WAITER_TO_VENUE" && { venueId }),
      ...(direction === "VENUE_TO_WAITER" && { subjectId, venueId: venueId ?? null }),
      ...(direction === "GUEST_TO_WAITER" && {
        subjectId,
        venueId: guestVenueId,
        guestLatitude: guestLat,
        guestLongitude: guestLon,
        geolocationHash,
      }),
      // Category ratings — clamped to 0-100 to protect score sync
      ...(direction === "WAITER_TO_VENUE" && {
        ratingAtmosphere:   clampRating(ratingAtmosphere),
        ratingOrganization: clampRating(ratingOrganization),
        ratingPay:          clampRating(ratingPay),
        ratingTips:         clampRating(ratingTips),
        ratingHygieneWork:  clampRating(ratingHygieneWork),
        ratingManagement:   clampRating(ratingManagement),
      }),
      ...(direction === "VENUE_TO_WAITER" && {
        ratingPunctuality:        clampRating(ratingPunctuality),
        ratingSkill:              clampRating(ratingSkill),
        ratingGuestCommunication: clampRating(ratingGuestCommunication),
        ratingPersonalHygiene:    clampRating(ratingPersonalHygiene),
        ratingTeamwork:           clampRating(ratingTeamwork),
        ratingSpeed:              clampRating(ratingSpeed),
      }),
      ...(direction === "GUEST_TO_WAITER" && {
        ratingFriendliness:  clampRating(ratingFriendliness),
        ratingGuestSpeed:    clampRating(ratingGuestSpeed),
        ratingAttentiveness: clampRating(ratingAttentiveness),
      }),
    },
  });

  // Fire-and-forget side effects
  const stars = Math.round(rating / 20);
  fireSideEffects({
    syncVenueId:  direction === "WAITER_TO_VENUE" ? (venueId ?? null) : null,
    syncWaiterId: (direction === "VENUE_TO_WAITER" || direction === "GUEST_TO_WAITER") ? (subjectId ?? null) : null,
    notifications: venueOwnerId
      ? [{
          userId: venueOwnerId,
          type:   "REVIEW_RECEIVED" as const,
          title:  "Nova recenzija lokala",
          body:   `${session.user.name ?? "Konobar"} je ocenio vaš lokal sa ${stars}★`,
          link:   "/venue",
        }]
      : [],
  });

  return NextResponse.json(review, { status: 201 });
});
