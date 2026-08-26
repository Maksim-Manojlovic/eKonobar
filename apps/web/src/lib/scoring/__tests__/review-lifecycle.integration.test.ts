import { describe, it, expect, beforeEach } from "vitest";
import { resetDb, seedUser } from "@/tests/integration/db-reset";
import { publishDueReviews } from "../review-lifecycle";
import { dbRaw } from "@/lib/core/db";

// Validates publishDueReviews() against real PostgreSQL.
// Unit test mocked updateMany — the real WHERE clause was never executed.
// Key behaviours proven here:
//   - pendingUntil <= now  → status flips to PUBLISHED, publishedAt set
//   - pendingUntil > now   → stays PENDING
//   - pendingUntil IS NULL → stays PENDING (not auto-published by cron)
//   - PUBLISHED/REMOVED rows → untouched regardless of pendingUntil
//   - return value = exact count of rows changed

const PAST   = new Date(Date.now() - 60_000);   // 1 min ago — due
const FUTURE = new Date(Date.now() + 60_000_000); // ~17 h from now — not due

beforeEach(async () => {
  await resetDb();
});

// ── Helpers ───────────────────────────────────────────────────────────────────

async function createVenueContext() {
  const ownerId = await seedUser({ role: "VENUE_OWNER" });
  const venue   = await dbRaw.venue.create({
    data: {
      ownerId,
      name:         "Test Venue",
      address:      "Addr",
      municipality: "Beograd",
      venueType:    "RESTAURANT",
      latitude:     44.8,
      longitude:    20.4,
    },
  });
  return { ownerId, venueId: venue.id };
}

async function seedReview(
  venueId: string,
  opts: {
    status?: "PENDING" | "PUBLISHED" | "REMOVED" | "DISPUTED";
    pendingUntil?: Date | null;
    direction?: "WAITER_TO_VENUE" | "VENUE_TO_WAITER" | "GUEST_TO_VENUE" | "GUEST_TO_WAITER";
  } = {},
) {
  return dbRaw.review.create({
    data: {
      venueId,
      direction:    opts.direction    ?? "WAITER_TO_VENUE",
      status:       opts.status       ?? "PENDING",
      pendingUntil: opts.pendingUntil ?? FUTURE,
      overallRating: 70,
      weight:        1.0,
      ratingAtmosphere:   70, ratingOrganization: 70,
      ratingPay:          70, ratingTips:         70,
      ratingHygieneWork:  70, ratingManagement:   70,
    },
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("publishDueReviews — real DB", () => {
  it("returns 0 when no reviews are due", async () => {
    const { venueId } = await createVenueContext();
    await seedReview(venueId, { pendingUntil: FUTURE });
    expect(await publishDueReviews()).toBe(0);
  });

  it("publishes due review: status → PUBLISHED, publishedAt set", async () => {
    const { venueId } = await createVenueContext();
    const r = await seedReview(venueId, { pendingUntil: PAST });

    expect(await publishDueReviews()).toBe(1);

    const updated = await dbRaw.review.findUnique({ where: { id: r.id } });
    expect(updated!.status).toBe("PUBLISHED");
    expect(updated!.publishedAt).not.toBeNull();
  });

  it("future pendingUntil stays PENDING", async () => {
    const { venueId } = await createVenueContext();
    const r = await seedReview(venueId, { pendingUntil: FUTURE });

    await publishDueReviews();

    const unchanged = await dbRaw.review.findUnique({ where: { id: r.id } });
    expect(unchanged!.status).toBe("PENDING");
    expect(unchanged!.publishedAt).toBeNull();
  });

  it("null pendingUntil stays PENDING — not auto-published by cron", async () => {
    const { venueId } = await createVenueContext();
    const r = await seedReview(venueId, { pendingUntil: null });

    await publishDueReviews();

    const unchanged = await dbRaw.review.findUnique({ where: { id: r.id } });
    expect(unchanged!.status).toBe("PENDING");
  });

  it("already-PUBLISHED review is not re-published", async () => {
    const { venueId } = await createVenueContext();
    const published = new Date(Date.now() - 3_600_000); // 1h ago
    const r = await dbRaw.review.create({
      data: {
        venueId,
        direction:     "WAITER_TO_VENUE",
        status:        "PUBLISHED",
        publishedAt:   published,
        pendingUntil:  PAST,
        overallRating: 80,
        weight:        1.0,
        ratingAtmosphere: 80, ratingOrganization: 80,
        ratingPay: 80, ratingTips: 80,
        ratingHygieneWork: 80, ratingManagement: 80,
      },
    });

    expect(await publishDueReviews()).toBe(0);

    const unchanged = await dbRaw.review.findUnique({ where: { id: r.id } });
    // publishedAt must not be overwritten
    expect(unchanged!.publishedAt!.toISOString()).toBe(published.toISOString());
  });

  it("REMOVED review is not touched", async () => {
    const { venueId } = await createVenueContext();
    const r = await seedReview(venueId, { status: "REMOVED", pendingUntil: PAST });

    expect(await publishDueReviews()).toBe(0);

    const unchanged = await dbRaw.review.findUnique({ where: { id: r.id } });
    expect(unchanged!.status).toBe("REMOVED");
  });

  it("publishes only due reviews from a mixed set; count is exact", async () => {
    const { venueId } = await createVenueContext();
    await seedReview(venueId, { pendingUntil: PAST });    // due
    await seedReview(venueId, { pendingUntil: PAST });    // due
    await seedReview(venueId, { pendingUntil: FUTURE });  // not yet
    await seedReview(venueId, { pendingUntil: null });    // no schedule

    expect(await publishDueReviews()).toBe(2);

    const allReviews = await dbRaw.review.findMany({ where: { venueId } });
    const published = allReviews.filter(r => r.status === "PUBLISHED");
    const pending   = allReviews.filter(r => r.status === "PENDING");
    expect(published).toHaveLength(2);
    expect(pending).toHaveLength(2);
  });

  it("idempotent: second call publishes 0 already-published reviews", async () => {
    const { venueId } = await createVenueContext();
    await seedReview(venueId, { pendingUntil: PAST });

    expect(await publishDueReviews()).toBe(1);
    expect(await publishDueReviews()).toBe(0); // idempotent
  });

  it("GUEST_TO_VENUE direction published correctly", async () => {
    const { venueId } = await createVenueContext();
    const r = await seedReview(venueId, {
      direction:    "GUEST_TO_VENUE",
      pendingUntil: PAST,
    });

    await publishDueReviews();

    const updated = await dbRaw.review.findUnique({ where: { id: r.id } });
    expect(updated!.status).toBe("PUBLISHED");
  });
});
