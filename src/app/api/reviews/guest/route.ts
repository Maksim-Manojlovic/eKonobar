import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { syncPassportScore, syncVenueTrustScore } from "@/lib/sync-scores";
import { isInsideVenueRadius, createGeolocationHash, parseGuestCoordinates } from "@/lib/geofence";
import { rateLimit } from "@/lib/rate-limit";
import { notify } from "@/lib/notify";

function clampRating(v: unknown): number | null {
  if (v == null) return null;
  const n = Number(v);
  return isNaN(n) ? null : Math.min(100, Math.max(0, n));
}

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

  const body = await req.json();
  const {
    venueId,
    direction = "GUEST_TO_WAITER",
    subjectId,
    guestHandle,
    overallRating,
    comment,
    guestLatitude,
    guestLongitude,
    // GUEST_TO_WAITER fields
    ratingFriendliness,
    ratingGuestSpeed,
    ratingAttentiveness,
    // GUEST_TO_VENUE fields
    ratingAtmosphere,
    ratingOrganization,
    ratingHygieneWork,
  } = body;

  if (!venueId) {
    return NextResponse.json({ error: "venueId required" }, { status: 400 });
  }

  if (direction !== "GUEST_TO_WAITER" && direction !== "GUEST_TO_VENUE") {
    return NextResponse.json({ error: "Invalid direction" }, { status: 400 });
  }

  if (direction === "GUEST_TO_WAITER" && !subjectId) {
    return NextResponse.json({ error: "subjectId required for GUEST_TO_WAITER" }, { status: 400 });
  }

  const rating = Number(overallRating);
  if (isNaN(rating) || rating < 0 || rating > 100) {
    return NextResponse.json({ error: "overallRating must be 0-100" }, { status: 400 });
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
        guestHandle:     guestHandle ? String(guestHandle).slice(0, 50) : null,
        direction:       "GUEST_TO_VENUE",
        subjectId:       null,
        venueId,
        overallRating:   rating,
        comment:         comment ? String(comment).slice(0, 1000) : null,
        weight:          1.0,
        pendingUntil,
        guestLatitude:   coords?.lat ?? null,
        guestLongitude:  coords?.lon ?? null,
        geolocationHash: geolocationHash ?? null,
        ratingAtmosphere:   clampRating(ratingAtmosphere),
        ratingOrganization: clampRating(ratingOrganization),
        ratingHygieneWork:  clampRating(ratingHygieneWork),
      },
    });

    syncVenueTrustScore(venueId).catch(console.error);
    if (venue.ownerId) {
      const stars = Math.round(rating / 20);
      notify(venue.ownerId, "REVIEW_RECEIVED", "Nova recenzija lokala",
        `Gost je ocenio vaš lokal sa ${stars}★`, "/venue").catch(console.error);
    }
    return NextResponse.json({ ok: true, id: review.id }, { status: 201 });
  }

  // GUEST_TO_WAITER (original flow)
  const review = await db.review.create({
    data: {
      authorId:     null,
      guestHandle:  guestHandle ? String(guestHandle).slice(0, 50) : null,
      direction:    "GUEST_TO_WAITER",
      subjectId,
      venueId,
      overallRating: rating,
      comment:       comment ? String(comment).slice(0, 1000) : null,
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

  syncPassportScore(subjectId).catch(console.error);
  if (venue.ownerId) {
    const stars = Math.round(rating / 20);
    notify(venue.ownerId, "REVIEW_RECEIVED", "Nova gostinska recenzija",
      `Gost je ocenio konobara sa ${stars}★`, "/venue").catch(console.error);
  }
  return NextResponse.json({ ok: true, id: review.id }, { status: 201 });
}
