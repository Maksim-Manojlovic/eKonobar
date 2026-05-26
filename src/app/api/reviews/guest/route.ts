import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/core/db";
import { fireSideEffects } from "@/lib/notifications/side-effects";
import { isInsideVenueRadius, createGeolocationHash, parseGuestCoordinates } from "@/lib/geo/geofence";
import { rateLimit } from "@/lib/core/rate-limit";
import { clampRating } from "@/lib/formatting/utils";
import { parseBody } from "@/lib/auth/parse-body";
import { z } from "zod";

const RatingDim = z.number().nullish(); // clampRating() enforces 0-100 at write time

const GuestReviewSchema = z.object({
  venueId:         z.string().min(1),
  direction:       z.enum(["GUEST_TO_WAITER", "GUEST_TO_VENUE"]).default("GUEST_TO_WAITER"),
  subjectId:       z.string().optional(),
  guestHandle:     z.string().max(50).nullish(),
  overallRating:   z.number().min(0).max(100),
  comment:         z.string().max(1000).nullish(),
  guestLatitude:   z.number().optional(),
  guestLongitude:  z.number().optional(),
  // GUEST_TO_WAITER
  ratingFriendliness:  RatingDim,
  ratingGuestSpeed:    RatingDim,
  ratingAttentiveness: RatingDim,
  // GUEST_TO_VENUE
  ratingAtmosphere:   RatingDim,
  ratingOrganization: RatingDim,
  ratingHygieneWork:  RatingDim,
});

export async function POST(req: NextRequest) {
  // IP-based rate limit: 3 guest reviews per hour per IP
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const allowed = await rateLimit(`guest_review:${ip}`, 3, 60 * 60 * 1000);
  if (!allowed) {
    return NextResponse.json(
      { error: "Previše recenzija. Pokušajte ponovo za sat vremena." },
      { status: 429 },
    );
  }

  const parsed = await parseBody(GuestReviewSchema, req);
  if (!parsed.ok) return parsed.response;
  const {
    venueId,
    direction,
    subjectId,
    guestHandle,
    overallRating: rating,
    comment,
    guestLatitude,
    guestLongitude,
    ratingFriendliness,
    ratingGuestSpeed,
    ratingAttentiveness,
    ratingAtmosphere,
    ratingOrganization,
    ratingHygieneWork,
  } = parsed.data;

  if (direction === "GUEST_TO_WAITER" && !subjectId) {
    return NextResponse.json({ error: "subjectId required for GUEST_TO_WAITER" }, { status: 400 });
  }

  const venue = await db.venue.findUnique({
    where: { id: venueId },
    select: { latitude: true, longitude: true, reviewRadiusKm: true, geofenceEnabled: true, ownerId: true, name: true },
  });
  if (!venue) return NextResponse.json({ error: "Lokal nije pronađen" }, { status: 404 });

  const coords = parseGuestCoordinates(guestLatitude, guestLongitude);

  if (venue.geofenceEnabled) {
    if (!coords) {
      return NextResponse.json(
        { error: "Koordinate su obavezne za gostinsku recenziju" },
        { status: 400 },
      );
    }
    const geofence = isInsideVenueRadius(coords, venue);
    if (!geofence.allowed) {
      return NextResponse.json(
        {
          error: `Morate biti u lokalu da biste ostavili recenziju (${Math.round(geofence.distanceKm * 1000)}m od lokala, dozvoljeno ${Math.round(geofence.radiusKm * 1000)}m)`,
        },
        { status: 403 },
      );
    }
  }

  const geolocationHash = coords ? createGeolocationHash(coords.lat, coords.lon) : undefined;
  const pendingUntil = new Date(Date.now() + 2 * 60 * 60 * 1000);

  if (direction === "GUEST_TO_VENUE") {
    const review = await db.review.create({
      data: {
        authorId:        null,
        guestHandle:     guestHandle ?? null,
        direction:       "GUEST_TO_VENUE",
        subjectId:       null,
        venueId,
        overallRating:   rating,
        comment:         comment ?? null,
        weight:          0.7, // 3 of 6 venue dimensions — lower weight prevents unequal Bayesian pull vs full waiter reviews
        pendingUntil,
        guestLatitude:   coords?.lat ?? null,
        guestLongitude:  coords?.lon ?? null,
        geolocationHash: geolocationHash ?? null,
        ratingAtmosphere:   clampRating(ratingAtmosphere),
        ratingOrganization: clampRating(ratingOrganization),
        ratingHygieneWork:  clampRating(ratingHygieneWork),
      },
    });

    const starsV = Math.round(rating / 20);
    fireSideEffects({
      syncVenueId: venueId,
      notifications: venue.ownerId ? [{
        userId: venue.ownerId,
        type:   "REVIEW_RECEIVED",
        title:  "Nova recenzija lokala",
        body:   `Gost je ocenio vaš lokal sa ${starsV}★`,
        link:   "/venue",
      }] : [],
    });
    return NextResponse.json({ ok: true, id: review.id }, { status: 201 });
  }

  // GUEST_TO_WAITER (original flow)
  const review = await db.review.create({
    data: {
      authorId:     null,
      guestHandle:  guestHandle ?? null,
      direction:    "GUEST_TO_WAITER",
      subjectId,
      venueId,
      overallRating: rating,
      comment:       comment ?? null,
      weight:        1.0,
      pendingUntil,
      guestLatitude:  coords?.lat ?? null,
      guestLongitude: coords?.lon ?? null,
      geolocationHash: geolocationHash ?? null,
      ratingFriendliness:  clampRating(ratingFriendliness),
      ratingGuestSpeed:    clampRating(ratingGuestSpeed),
      ratingAttentiveness: clampRating(ratingAttentiveness),
    },
  });

  const starsW = Math.round(rating / 20);
  fireSideEffects({
    syncWaiterId: subjectId,
    notifications: venue.ownerId ? [{
      userId: venue.ownerId,
      type:   "REVIEW_RECEIVED",
      title:  "Nova gostinska recenzija",
      body:   `Gost je ocenio konobara sa ${starsW}★`,
      link:   "/venue",
    }] : [],
  });
  return NextResponse.json({ ok: true, id: review.id }, { status: 201 });
}
