import { NextRequest } from "next/server";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
// Pass through unstable_cache so the route calls fetchStats directly (no caching in tests)
vi.mock("next/cache", () => ({ unstable_cache: (fn: () => unknown) => fn }));
vi.mock("@/lib/db", () => ({
  dbRaw: {
    user:            { groupBy: vi.fn(), count: vi.fn() },
    waiterPassport:  { groupBy: vi.fn(), count: vi.fn() },
    venue:           { count: vi.fn() },
    jobPost:         { count: vi.fn() },
    jobApplication:  { count: vi.fn() },
    review:          { groupBy: vi.fn() },
    sanitaryBook:    { count: vi.fn() },
    passportPayment: { count: vi.fn(), aggregate: vi.fn() },
  },
}));

import { getServerSession } from "next-auth";
import { dbRaw } from "@/lib/db";
import { GET } from "../route";

function mockSession(role = "ADMIN", id = "admin-1") {
  vi.mocked(getServerSession).mockResolvedValue({ user: { id, role } } as never);
}

function mockNoSession() {
  vi.mocked(getServerSession).mockResolvedValue(null);
}
function makeReq() {  return new NextRequest("http://localhost");}

const CTX = { params: Promise.resolve({}) };

function setupDefaultMocks() {
  vi.mocked(dbRaw.user.groupBy).mockResolvedValue([
    { role: "WAITER",      _count: { _all: 10 } },
    { role: "VENUE_OWNER", _count: { _all: 5  } },
  ] as never);
  vi.mocked(dbRaw.waiterPassport.groupBy).mockResolvedValue([
    { passportTier: "FREE",     _count: { _all: 8 } },
    { passportTier: "PRO",      _count: { _all: 2 } },
    { passportTier: "PRO_PLUS", _count: { _all: 1 } },
  ] as never);
  vi.mocked(dbRaw.waiterPassport.count).mockResolvedValue(4);
  vi.mocked(dbRaw.user.count).mockResolvedValue(3);
  vi.mocked(dbRaw.venue.count).mockResolvedValue(7);
  vi.mocked(dbRaw.jobPost.count)
    .mockResolvedValueOnce(12)  // openJobs
    .mockResolvedValueOnce(3);  // redAlertJobs
  vi.mocked(dbRaw.jobApplication.count)
    .mockResolvedValueOnce(50) // total
    .mockResolvedValueOnce(8); // pending
  vi.mocked(dbRaw.review.groupBy).mockResolvedValue([
    { status: "PUBLISHED", _count: { _all: 20 } },
    { status: "PENDING",   _count: { _all: 5  } },
    { status: "DISPUTED",  _count: { _all: 2  } },
  ] as never);
  vi.mocked(dbRaw.sanitaryBook.count).mockResolvedValue(1);
  vi.mocked(dbRaw.passportPayment.count).mockResolvedValue(15);
  vi.mocked(dbRaw.passportPayment.aggregate).mockResolvedValue({
    _sum: { amountRsd: 580000 },
  } as never);
}

describe("GET /api/admin/stats", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession();
    setupDefaultMocks();
  });

  it("ADMIN gets stats → 200", async () => {
    const res = await GET(makeReq(), CTX);
    expect(res.status).toBe(200);
  });

  it("non-ADMIN → 403", async () => {
    mockSession("VENUE_OWNER", "o-1");
    const res = await GET(makeReq(), CTX);
    expect(res.status).toBe(403);
  });

  it("unauthenticated → 401", async () => {
    mockNoSession();
    const res = await GET(makeReq(), CTX);
    expect(res.status).toBe(401);
  });

  it("users shape mapped from groupBy result", async () => {
    const res = await GET(makeReq(), CTX);
    const json = await res.json();
    expect(json.users.waiters).toBe(10);
    expect(json.users.venueOwners).toBe(5);
    expect(json.users.total).toBe(15);
  });

  it("passports shape with tier breakdown", async () => {
    const res = await GET(makeReq(), CTX);
    const json = await res.json();
    expect(json.passports.free).toBe(8);
    expect(json.passports.pro).toBe(2);
    expect(json.passports.proPlus).toBe(1);
    expect(json.passports.total).toBe(11);
  });

  it("reviews shape with all statuses", async () => {
    const res = await GET(makeReq(), CTX);
    const json = await res.json();
    expect(json.reviews.published).toBe(20);
    expect(json.reviews.pending).toBe(5);
    expect(json.reviews.disputed).toBe(2);
    expect(json.reviews.removed).toBe(0); // missing from mock → defaults to 0
  });

  it("revenue converted from minor units (÷100)", async () => {
    const res = await GET(makeReq(), CTX);
    const json = await res.json();
    expect(json.payments.revenueThisMonth).toBe(5800); // 580000 / 100
  });

  it("missing roles default to 0", async () => {
    vi.mocked(dbRaw.user.groupBy).mockResolvedValue([
      { role: "WAITER", _count: { _all: 5 } },
      // HEADHUNTER and ADMIN omitted
    ] as never);

    const res = await GET(makeReq(), CTX);
    const json = await res.json();
    expect(json.users.headhunters).toBe(0);
    expect(json.users.admins).toBe(0);
  });

  it("null amountRsd sum → revenue 0", async () => {
    vi.mocked(dbRaw.passportPayment.aggregate).mockResolvedValue({
      _sum: { amountRsd: null },
    } as never);

    const res = await GET(makeReq(), CTX);
    const json = await res.json();
    expect(json.payments.revenueThisMonth).toBe(0);
  });
});
