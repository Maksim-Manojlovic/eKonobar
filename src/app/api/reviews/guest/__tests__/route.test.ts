import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/core/db", () => ({
  db: {
    venue:  { findUnique: vi.fn() },
    review: { create: vi.fn() },
  },
}));
vi.mock("@/lib/notifications/side-effects", () => ({ fireSideEffects: vi.fn() }));
vi.mock("@/lib/geo/geofence", () => ({
  isInsideVenueRadius:   vi.fn(),
  parseGuestCoordinates: vi.fn(),
  createGeolocationHash: vi.fn().mockReturnValue("hash-abc"),
}));
vi.mock("@/lib/core/rate-limit", () => ({ rateLimit: vi.fn() }));

import { db } from "@/lib/core/db";
import { fireSideEffects } from "@/lib/notifications/side-effects";
import { isInsideVenueRadius, parseGuestCoordinates } from "@/lib/geo/geofence";
import { rateLimit } from "@/lib/core/rate-limit";
import { POST } from "../route";

const VENUE_ID   = "venue-1";
const OWNER_ID   = "owner-1";
const WAITER_ID  = "waiter-1";

const BASE_VENUE = {
  latitude: 44.8176, longitude: 20.4633,
  reviewRadiusKm: 0.15,
  geofenceEnabled: false, // off by default — most tests don't need geo
  ownerId: OWNER_ID,
  name: "Test Venue",
};

const WAITER_BODY = {
  venueId: VENUE_ID, direction: "GUEST_TO_WAITER", subjectId: WAITER_ID,
  overallRating: 80, ratingFriendliness: 80, ratingGuestSpeed: 80, ratingAttentiveness: 80,
};

const VENUE_BODY = {
  venueId: VENUE_ID, direction: "GUEST_TO_VENUE",
  overallRating: 75, ratingAtmosphere: 70, ratingOrganization: 80, ratingHygieneWork: 75,
};

function makeReq(body: object, ip = "1.2.3.4") {
  return new NextRequest("http://localhost/api/reviews/guest", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify(body),
  });
}

describe("POST /api/reviews/guest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(rateLimit).mockResolvedValue(true);
    vi.mocked(db.venue.findUnique).mockResolvedValue(BASE_VENUE as never);
    vi.mocked(db.review.create).mockResolvedValue({ id: "review-1" } as never);
    vi.mocked(parseGuestCoordinates).mockReturnValue(null);
  });

  it("returns 429 when rate limit exceeded", async () => {
    vi.mocked(rateLimit).mockResolvedValue(false);
    const res = await POST(makeReq(WAITER_BODY));
    expect(res.status).toBe(429);
  });

  it("returns 400 when venueId missing", async () => {
    const res = await POST(makeReq({ direction: "GUEST_TO_WAITER", overallRating: 80 }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid direction", async () => {
    const res = await POST(makeReq({ ...WAITER_BODY, direction: "INVALID" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when GUEST_TO_WAITER missing subjectId", async () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { subjectId: _subjectId, ...body } = WAITER_BODY;
    const res = await POST(makeReq(body));
    expect(res.status).toBe(400);
    const d = await res.json();
    expect(d.error).toMatch(/subjectId/i);
  });

  it("returns 400 when overallRating > 100", async () => {
    const res = await POST(makeReq({ ...WAITER_BODY, overallRating: 101 }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when overallRating < 0", async () => {
    const res = await POST(makeReq({ ...WAITER_BODY, overallRating: -1 }));
    expect(res.status).toBe(400);
  });

  it("returns 404 when venue not found", async () => {
    vi.mocked(db.venue.findUnique).mockResolvedValue(null);
    const res = await POST(makeReq(WAITER_BODY));
    expect(res.status).toBe(404);
  });

  it("returns 400 when geofence enabled but no coordinates", async () => {
    vi.mocked(db.venue.findUnique).mockResolvedValue({ ...BASE_VENUE, geofenceEnabled: true } as never);
    vi.mocked(parseGuestCoordinates).mockReturnValue(null);
    const res = await POST(makeReq(WAITER_BODY));
    expect(res.status).toBe(400);
    const d = await res.json();
    expect(d.error).toMatch(/koordinate/i);
  });

  it("returns 403 when guest is outside geofence radius", async () => {
    vi.mocked(db.venue.findUnique).mockResolvedValue({ ...BASE_VENUE, geofenceEnabled: true } as never);
    vi.mocked(parseGuestCoordinates).mockReturnValue({ lat: 44.9, lon: 20.6 });
    vi.mocked(isInsideVenueRadius).mockReturnValue({ allowed: false, distanceKm: 1.2, radiusKm: 0.15 });
    const res = await POST(makeReq({ ...WAITER_BODY, guestLatitude: 44.9, guestLongitude: 20.6 }));
    expect(res.status).toBe(403);
  });

  it("skips geofence check when venue has geofenceEnabled=false", async () => {
    const res = await POST(makeReq({ ...WAITER_BODY, guestLatitude: 99, guestLongitude: 99 }));
    expect(res.status).toBe(201);
    expect(isInsideVenueRadius).not.toHaveBeenCalled();
  });

  it("GUEST_TO_WAITER: creates review and triggers passport score sync", async () => {
    const res = await POST(makeReq(WAITER_BODY));
    expect(res.status).toBe(201);
    const d = await res.json();
    expect(d.ok).toBe(true);
    expect(d.id).toBe("review-1");

    const created = vi.mocked(db.review.create).mock.calls[0][0].data;
    expect(created.direction).toBe("GUEST_TO_WAITER");
    expect(created.subjectId).toBe(WAITER_ID);
    expect(created.authorId).toBeNull();
    expect(created.weight).toBe(1.0);

    expect(fireSideEffects).toHaveBeenCalledWith(
      expect.objectContaining({ syncWaiterId: WAITER_ID }),
    );
  });

  it("GUEST_TO_VENUE: creates review and triggers venue score sync", async () => {
    const res = await POST(makeReq(VENUE_BODY));
    expect(res.status).toBe(201);

    const created = vi.mocked(db.review.create).mock.calls[0][0].data;
    expect(created.direction).toBe("GUEST_TO_VENUE");
    expect(created.subjectId).toBeNull();
    expect(created.weight).toBe(0.7);

    expect(fireSideEffects).toHaveBeenCalledWith(
      expect.objectContaining({ syncVenueId: VENUE_ID }),
    );
  });

  it("returns 400 when guestHandle exceeds 50 chars", async () => {
    const longHandle = "A".repeat(60);
    const res = await POST(makeReq({ ...WAITER_BODY, guestHandle: longHandle }));
    expect(res.status).toBe(400);
    expect(db.review.create).not.toHaveBeenCalled();
  });

  it("geofence passes: records coords and hash", async () => {
    vi.mocked(db.venue.findUnique).mockResolvedValue({ ...BASE_VENUE, geofenceEnabled: true } as never);
    vi.mocked(parseGuestCoordinates).mockReturnValue({ lat: 44.8176, lon: 20.4633 });
    vi.mocked(isInsideVenueRadius).mockReturnValue({ allowed: true, distanceKm: 0.03, radiusKm: 0.15 });

    await POST(makeReq({ ...WAITER_BODY, guestLatitude: 44.8176, guestLongitude: 20.4633 }));

    const created = vi.mocked(db.review.create).mock.calls[0][0].data;
    expect(created.guestLatitude).toBe(44.8176);
    expect(created.geolocationHash).toBe("hash-abc");
  });
});
