import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { syncPassportScore } from "@/lib/sync-scores";
import { isInsideVenueRadius, createGeolocationHash, parseGuestCoordinates } from "@/lib/geofence";
import { rateLimit } from "@/lib/rate-limit";

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
    subjectId,
    guestHandle,
    overallRating,
    comment,
    guestLatitude,
    guestLongitude,
    ratingFriendliness,
    ratingGuestSpeed,
    ratingAttentiveness,
  } = body;

  if (!venueId || !subjectId) {
    return NextResponse.json({ error: "venueId and subjectId required" }, { status: 400 });
  }

  const rating = Number(overallRating);
  if (isNaN(rating) || rating < 0 || rating > 100) {
    return NextResponse.json({ error: "overallRating must be 0-100" }, { status: 400 });
  }

  // Geofence check
  const coords = parseGuestCoordinates(guestLatitude, guestLongitude);
  if (!coords) {
    return NextResponse.json(
      { error: "Koordinate su obavezne za gostinsku recenziju" },
      { status: 400 },
    );
  }

  const venue = await db.venue.findUnique({
    where: { id: venueId },
    select: { latitude: true, longitude: true, reviewRadiusKm: true },
  });
  if (!venue) return NextResponse.json({ error: "Lokal nije pronađen" }, { status: 404 });

  const geofence = isInsideVenueRadius(coords, venue);
  if (!geofence.allowed) {
    return NextResponse.json(
      {
        error: `Morate biti u lokalu da biste ostavili recenziju (${Math.round(geofence.distanceKm * 1000)}m od lokala, dozvoljeno ${Math.round(geofence.radiusKm * 1000)}m)`,
      },
      { status: 403 },
    );
  }

  const geolocationHash = createGeolocationHash(coords.lat, coords.lon);

  // Embargo: 2 hours before publishing
  const pendingUntil = new Date(Date.now() + 2 * 60 * 60 * 1000);

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
      guestLatitude:  coords.lat,
      guestLongitude: coords.lon,
      geolocationHash,
      ratingFriendliness:  ratingFriendliness  != null ? Number(ratingFriendliness)  : null,
      ratingGuestSpeed:    ratingGuestSpeed    != null ? Number(ratingGuestSpeed)    : null,
      ratingAttentiveness: ratingAttentiveness != null ? Number(ratingAttentiveness) : null,
    },
  });

  syncPassportScore(subjectId).catch(console.error);

  return NextResponse.json({ ok: true, id: review.id }, { status: 201 });
}
