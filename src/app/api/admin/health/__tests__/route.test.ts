import { NextRequest } from "next/server";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/db", () => ({
  dbRaw: {
    review:           { count: vi.fn(), findFirst: vi.fn() },
    waiterPassport:   { count: vi.fn() },
    passportPayment:  { findFirst: vi.fn() },
    user:             { count: vi.fn() },
    rateLimit:        { count: vi.fn() },
    shiftAssignment:  { count: vi.fn() },
  },
}));

import { getServerSession } from "next-auth";
import { dbRaw } from "@/lib/db";
import { GET } from "../route";

function mockSession(role = "ADMIN") {
  vi.mocked(getServerSession).mockResolvedValue({ user: { id: "a-1", role } } as never);
}

function mockNoSession() {
  vi.mocked(getServerSession).mockResolvedValue(null);
}
function makeReq() {  return new NextRequest("http://localhost");}

function setupDefaultMocks() {
  vi.mocked(dbRaw.review.count)
    .mockResolvedValueOnce(0)   // overdueGuestReviews
    .mockResolvedValueOnce(2);  // overdueRegularReviews
  vi.mocked(dbRaw.waiterPassport.count).mockResolvedValue(3);
  vi.mocked(dbRaw.review.findFirst).mockResolvedValue({
    publishedAt: new Date("2025-01-01"),
  } as never);
  vi.mocked(dbRaw.passportPayment.findFirst).mockResolvedValue({
    createdAt: new Date("2025-01-02"),
  } as never);
  vi.mocked(dbRaw.user.count).mockResolvedValue(5);
  vi.mocked(dbRaw.rateLimit.count).mockResolvedValue(42);
  vi.mocked(dbRaw.shiftAssignment.count).mockResolvedValue(1);
}

describe("GET /api/admin/health", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession();
    setupDefaultMocks();
  });

  it("ADMIN gets health → 200", async () => {
    const res = await GET(makeReq());
    expect(res.status).toBe(200);
  });

  it("non-ADMIN → 403", async () => {
    mockSession("VENUE_OWNER");
    const res = await GET(makeReq());
    expect(res.status).toBe(403);
  });

  it("unauthenticated → 401", async () => {
    mockNoSession();
    const res = await GET(makeReq());
    expect(res.status).toBe(401);
  });

  it("response has expected top-level keys", async () => {
    const res = await GET(makeReq());
    const json = await res.json();
    expect(json).toHaveProperty("reviews");
    expect(json).toHaveProperty("passports");
    expect(json).toHaveProperty("cron");
    expect(json).toHaveProperty("users");
    expect(json).toHaveProperty("system");
  });

  it("reviews shape correct", async () => {
    const res = await GET(makeReq());
    const json = await res.json();
    expect(json.reviews.overdueGuest).toBe(0);
    expect(json.reviews.overdueRegular).toBe(2);
  });

  it("passports expiredPaid count returned", async () => {
    const res = await GET(makeReq());
    const json = await res.json();
    expect(json.passports.expiredPaid).toBe(3);
  });

  it("system metrics returned", async () => {
    const res = await GET(makeReq());
    const json = await res.json();
    expect(json.system.rateLimitEntries).toBe(42);
    expect(json.system.pendingClockIns).toBe(1);
  });

  it("cron timestamps returned as ISO strings", async () => {
    const res = await GET(makeReq());
    const json = await res.json();
    expect(json.cron.lastPublishedReviewAt).toBe("2025-01-01T00:00:00.000Z");
    expect(json.cron.lastRenewalPaymentAt).toBe("2025-01-02T00:00:00.000Z");
  });

  it("null lastPublishedReview → cron.lastPublishedReviewAt null", async () => {
    vi.mocked(dbRaw.review.findFirst).mockResolvedValue(null);
    const res = await GET(makeReq());
    const json = await res.json();
    expect(json.cron.lastPublishedReviewAt).toBeNull();
  });

  it("null lastRenewalPayment → cron.lastRenewalPaymentAt null", async () => {
    vi.mocked(dbRaw.passportPayment.findFirst).mockResolvedValue(null);
    const res = await GET(makeReq());
    const json = await res.json();
    expect(json.cron.lastRenewalPaymentAt).toBeNull();
  });

  it("users.softDeleted returned", async () => {
    const res = await GET(makeReq());
    const json = await res.json();
    expect(json.users.softDeleted).toBe(5);
  });
});
