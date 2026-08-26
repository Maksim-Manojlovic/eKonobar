import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Mock only side effects — DB reads/writes and geofencing stay real.
// isInsideVenueRadius is a pure function: we pass real coordinates instead of mocking it.
vi.mock("@/lib/notifications/side-effects", () => ({ fireSideEffects: vi.fn() }));

import { resetDb, seedUser } from "@/tests/integration/db-reset";
import { dbRaw } from "@/lib/core/db";
import { POST } from "../route";

// Venue coords — Belgrade centre
const VENUE_LAT  = 44.8176;
const VENUE_LON  = 20.4569;
// Same location: 0m distance — always inside 150m radius
const INSIDE_LAT = 44.8176;
const INSIDE_LON = 20.4569;
// Far away: ~4 km — always outside 150m radius
const OUTSIDE_LAT = 44.855;
const OUTSIDE_LON = 20.500;

async function createContext() {
  const ownerId = await seedUser({ role: "VENUE_OWNER" });
  const venue   = await dbRaw.venue.create({
    data: {
      ownerId,
      name:           "Test Venue",
      address:        "Str 1",
      municipality:   "Beograd",
      venueType:      "RESTAURANT",
      latitude:       VENUE_LAT,
      longitude:      VENUE_LON,
      reviewRadiusKm: 0.15,
      geofenceEnabled: true,
    },
  });
  return { ownerId, venueId: venue.id };
}

function makeReq(body: object) {
  return new NextRequest("http://localhost/api/reviews/guest", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(body),
  });
}

const VENUE_PAYLOAD = (venueId: string) => ({
  venueId,
  direction:          "GUEST_TO_VENUE",
  overallRating:      80,
  guestLatitude:      INSIDE_LAT,
  guestLongitude:     INSIDE_LON,
  ratingAtmosphere:   80,
  ratingOrganization: 70,
  ratingHygieneWork:  75,
});

beforeEach(async () => {
  await resetDb();
  vi.clearAllMocks();
});

// ── Venue not found ───────────────────────────────────────────────────────────

describe("POST /api/reviews/guest — integration", () => {
  it("nonexistent venueId → 404", async () => {
    const res = await POST(makeReq({ ...VENUE_PAYLOAD("nonexistent-id") }));
    expect(res.status).toBe(404);
  });

  // ── GUEST_TO_VENUE happy path ─────────────────────────────────────────────

  it("GUEST_TO_VENUE: review created in DB with 2h embargo", async () => {
    const { venueId } = await createContext();
    const res = await POST(makeReq(VENUE_PAYLOAD(venueId)));
    expect(res.status).toBe(201);
    const { id } = await res.json();

    const review = await dbRaw.review.findUnique({ where: { id } });
    expect(review).not.toBeNull();
    expect(review!.direction).toBe("GUEST_TO_VENUE");
    expect(review!.status).toBe("PENDING");
    expect(review!.venueId).toBe(venueId);
    expect(review!.authorId).toBeNull(); // guest = anonymous
    // pendingUntil ~2h from now
    expect(review!.pendingUntil!.getTime()).toBeGreaterThan(Date.now() + 60 * 60 * 1000);
    expect(review!.pendingUntil!.getTime()).toBeLessThan(Date.now() + 3 * 60 * 60 * 1000);
  });

  it("GUEST_TO_VENUE: coordinates stored on review row", async () => {
    const { venueId } = await createContext();
    const res = await POST(makeReq(VENUE_PAYLOAD(venueId)));
    const { id } = await res.json();
    const review = await dbRaw.review.findUnique({ where: { id } });
    expect(review!.guestLatitude).toBeCloseTo(INSIDE_LAT, 4);
    expect(review!.guestLongitude).toBeCloseTo(INSIDE_LON, 4);
    expect(review!.geolocationHash).not.toBeNull();
  });

  // ── GUEST_TO_WAITER happy path ────────────────────────────────────────────

  it("GUEST_TO_WAITER with linked waiter: review created", async () => {
    const { venueId } = await createContext();
    const waiterId = await seedUser({ role: "WAITER" });
    // Link waiter to venue via EngagementRecord
    await dbRaw.engagementRecord.create({
      data: { waiterId, venueId, startDate: new Date(), engagementType: "FULL_TIME" },
    });

    const res = await POST(makeReq({
      venueId,
      direction:          "GUEST_TO_WAITER",
      subjectId:          waiterId,
      overallRating:      80,
      guestLatitude:      INSIDE_LAT,
      guestLongitude:     INSIDE_LON,
      ratingFriendliness:  80,
      ratingGuestSpeed:    70,
      ratingAttentiveness: 75,
    }));
    expect(res.status).toBe(201);

    const { id } = await res.json();
    const review = await dbRaw.review.findUnique({ where: { id } });
    expect(review!.direction).toBe("GUEST_TO_WAITER");
    expect(review!.subjectId).toBe(waiterId);
    expect(review!.venueId).toBe(venueId);
  });

  // ── Geofencing — real isInsideVenueRadius ─────────────────────────────────

  it("coordinates outside radius → 403 (real haversine check)", async () => {
    const { venueId } = await createContext();
    const res = await POST(makeReq({
      ...VENUE_PAYLOAD(venueId),
      guestLatitude:  OUTSIDE_LAT,
      guestLongitude: OUTSIDE_LON,
    }));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toMatch(/lokalu/i);
  });

  it("missing coords with geofence enabled → 400", async () => {
    const { venueId } = await createContext();
    const res = await POST(makeReq({
      ...VENUE_PAYLOAD(venueId),
      guestLatitude:  undefined,
      guestLongitude: undefined,
    }));
    expect(res.status).toBe(400);
  });

  it("geofenceEnabled=false: no coordinate check, review created", async () => {
    const ownerId = await seedUser({ role: "VENUE_OWNER" });
    const venue   = await dbRaw.venue.create({
      data: {
        ownerId,
        name:            "Open Venue",
        address:         "A",
        municipality:    "B",
        venueType:       "CAFE",
        latitude:        VENUE_LAT,
        longitude:       VENUE_LON,
        geofenceEnabled: false,
      },
    });
    // No coordinates in request — geofence is disabled so no 400
    const res = await POST(makeReq({
      venueId:            venue.id,
      direction:          "GUEST_TO_VENUE",
      overallRating:      70,
      ratingAtmosphere:   70,
      ratingOrganization: 70,
      ratingHygieneWork:  70,
    }));
    expect(res.status).toBe(201);
  });

  // ── Waiter–venue link guard ───────────────────────────────────────────────

  it("GUEST_TO_WAITER: unlinked waiter → 403", async () => {
    const { venueId } = await createContext();
    const waiterId = await seedUser({ role: "WAITER" });
    // No EngagementRecord or Application linking waiter to venue
    const res = await POST(makeReq({
      venueId,
      direction:          "GUEST_TO_WAITER",
      subjectId:          waiterId,
      overallRating:      80,
      guestLatitude:      INSIDE_LAT,
      guestLongitude:     INSIDE_LON,
      ratingFriendliness: 80,
    }));
    expect(res.status).toBe(403);
    expect((await res.json()).error).toMatch(/nije povezan/i);
  });

  it("GUEST_TO_WAITER: missing subjectId → 400", async () => {
    const { venueId } = await createContext();
    const res = await POST(makeReq({
      venueId,
      direction:          "GUEST_TO_WAITER",
      overallRating:      80,
      guestLatitude:      INSIDE_LAT,
      guestLongitude:     INSIDE_LON,
    }));
    expect(res.status).toBe(400);
  });

  // ── IP rate limiting — real AnonRateLimit table ───────────────────────────

  it("4th request from same IP → 429 (real ON CONFLICT counter)", async () => {
    const { venueId } = await createContext();
    const payload = VENUE_PAYLOAD(venueId);
    // 3 allowed (limit = 3 per hour)
    await POST(makeReq(payload));
    await POST(makeReq(payload));
    await POST(makeReq(payload));
    // 4th blocked
    const res = await POST(makeReq(payload));
    expect(res.status).toBe(429);
  });
});
