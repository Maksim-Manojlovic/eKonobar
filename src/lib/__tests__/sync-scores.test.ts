import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  dbRaw: {
    review:            { updateMany: vi.fn(), findMany: vi.fn() },
    venue:             { update: vi.fn() },
    venueTrustScore:   { upsert: vi.fn() },
    waiterPassport:    { findUnique: vi.fn(), update: vi.fn() },
    passportTrustScore:{ upsert: vi.fn() },
    $transaction:      vi.fn(),
  },
}));

import { dbRaw } from "@/lib/db";
import {
  publishDueReviews,
  syncVenueTrustScore,
  syncPassportScore,
} from "../sync-scores";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const raw = dbRaw as any;

describe("publishDueReviews", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns count of published reviews", async () => {
    vi.mocked(raw.review.updateMany).mockResolvedValue({ count: 5 });
    const result = await publishDueReviews();
    expect(result).toBe(5);
  });

  it("returns 0 when nothing to publish", async () => {
    vi.mocked(raw.review.updateMany).mockResolvedValue({ count: 0 });
    const result = await publishDueReviews();
    expect(result).toBe(0);
  });

  it("queries PENDING reviews with pendingUntil lte now", async () => {
    vi.mocked(raw.review.updateMany).mockResolvedValue({ count: 0 });
    await publishDueReviews();
    expect(vi.mocked(raw.review.updateMany)).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: "PENDING" }),
        data:  expect.objectContaining({ status: "PUBLISHED" }),
      }),
    );
  });
});

describe("syncVenueTrustScore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(raw.review.findMany).mockResolvedValue([]);
    vi.mocked(raw.$transaction).mockResolvedValue([undefined, undefined]);
    vi.mocked(raw.venue.update).mockReturnValue(undefined);
    vi.mocked(raw.venueTrustScore.upsert).mockReturnValue(undefined);
  });

  it("queries WAITER_TO_VENUE and GUEST_TO_VENUE directions", async () => {
    await syncVenueTrustScore("v-1");
    expect(vi.mocked(raw.review.findMany)).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          venueId: "v-1",
          direction: { in: ["WAITER_TO_VENUE", "GUEST_TO_VENUE"] },
          status: "PUBLISHED",
        }),
      }),
    );
  });

  it("calls $transaction once with 2 operations", async () => {
    await syncVenueTrustScore("v-1");
    expect(vi.mocked(raw.$transaction)).toHaveBeenCalledTimes(1);
    const txArg = vi.mocked(raw.$transaction).mock.calls[0][0];
    expect(Array.isArray(txArg)).toBe(true);
    expect(txArg).toHaveLength(2);
  });

  it("updates venue.trustScore", async () => {
    await syncVenueTrustScore("v-1");
    expect(vi.mocked(raw.venue.update)).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "v-1" } }),
    );
  });

  it("upserts venueTrustScore with sampleSize = reviews.length", async () => {
    vi.mocked(raw.review.findMany).mockResolvedValue([
      { weight: 1, createdAt: new Date(), ratingAtmosphere: 80, ratingOrganization: 70,
        ratingPay: 60, ratingTips: 50, ratingHygieneWork: 75, ratingManagement: 65 },
    ]);
    await syncVenueTrustScore("v-1");
    expect(vi.mocked(raw.venueTrustScore.upsert)).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ sampleSize: 1 }),
        update: expect.objectContaining({ sampleSize: 1 }),
      }),
    );
  });
});

describe("syncPassportScore", () => {
  const PASSPORT = {
    id: "p-1",
    totalEngagements: 5,
    sanitaryBookValid: false,
    badges: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(raw.waiterPassport.findUnique).mockResolvedValue(PASSPORT);
    vi.mocked(raw.review.findMany).mockResolvedValue([]);
    vi.mocked(raw.$transaction).mockResolvedValue([undefined, undefined]);
    vi.mocked(raw.waiterPassport.update).mockReturnValue(undefined);
    vi.mocked(raw.passportTrustScore.upsert).mockReturnValue(undefined);
  });

  it("returns early when passport not found", async () => {
    vi.mocked(raw.waiterPassport.findUnique).mockResolvedValue(null);
    await syncPassportScore("w-1");
    expect(vi.mocked(raw.$transaction)).not.toHaveBeenCalled();
  });

  it("fetches VENUE_TO_WAITER and GUEST_TO_WAITER reviews in parallel", async () => {
    await syncPassportScore("w-1");
    expect(vi.mocked(raw.review.findMany)).toHaveBeenCalledTimes(2);
    const calls = vi.mocked(raw.review.findMany).mock.calls;
    const dirs = calls.map((c: [{ where: { direction: string } }]) => c[0].where.direction);
    expect(dirs).toContain("VENUE_TO_WAITER");
    expect(dirs).toContain("GUEST_TO_WAITER");
  });

  it("calls $transaction once with 2 operations", async () => {
    await syncPassportScore("w-1");
    expect(vi.mocked(raw.$transaction)).toHaveBeenCalledTimes(1);
    const txArg = vi.mocked(raw.$transaction).mock.calls[0][0];
    expect(txArg).toHaveLength(2);
  });

  it("adds sanitarna badge when sanitaryBookValid=true", async () => {
    vi.mocked(raw.waiterPassport.findUnique).mockResolvedValue({
      ...PASSPORT, sanitaryBookValid: true,
    });
    await syncPassportScore("w-1");
    expect(vi.mocked(raw.waiterPassport.update)).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          badges: expect.arrayContaining(["sanitarna"]),
        }),
      }),
    );
  });

  it("adds verified_history badge at 3+ engagements", async () => {
    vi.mocked(raw.waiterPassport.findUnique).mockResolvedValue({
      ...PASSPORT, totalEngagements: 3,
    });
    await syncPassportScore("w-1");
    expect(vi.mocked(raw.waiterPassport.update)).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          badges: expect.arrayContaining(["verified_history"]),
        }),
      }),
    );
  });

  it("no verified_history badge below 3 engagements", async () => {
    vi.mocked(raw.waiterPassport.findUnique).mockResolvedValue({
      ...PASSPORT, totalEngagements: 2,
    });
    await syncPassportScore("w-1");
    const updateCall = vi.mocked(raw.waiterPassport.update).mock.calls[0][0];
    expect(updateCall.data.badges).not.toContain("verified_history");
  });

  it("adds hospitality_pro badge at 50+ engagements", async () => {
    vi.mocked(raw.waiterPassport.findUnique).mockResolvedValue({
      ...PASSPORT, totalEngagements: 50,
    });
    await syncPassportScore("w-1");
    expect(vi.mocked(raw.waiterPassport.update)).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          badges: expect.arrayContaining(["hospitality_pro"]),
        }),
      }),
    );
  });
});
