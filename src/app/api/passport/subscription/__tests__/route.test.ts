import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/db", () => ({
  db: {
    waiterPassport: { findUnique: vi.fn() },
  },
}));

import { getServerSession } from "next-auth";
import { db } from "@/lib/db";
import { GET } from "../route";

const WAITER_ID = "waiter-1";
const FUTURE = new Date(Date.now() + 20 * 24 * 60 * 60 * 1000); // +20 days
const PAST   = new Date(Date.now() - 5  * 24 * 60 * 60 * 1000); // -5 days

function mockSession(role = "WAITER", id = WAITER_ID) {
  vi.mocked(getServerSession).mockResolvedValue({ user: { id, role } } as never);
}

function mockNoSession() {
  vi.mocked(getServerSession).mockResolvedValue(null);
}

describe("GET /api/passport/subscription", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession();
    vi.mocked(db.waiterPassport.findUnique).mockResolvedValue({
      passportTier: "PRO",
      subscriptionExpiresAt: FUTURE,
    } as never);
  });

  it("WAITER gets subscription → 200", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
  });

  it("non-WAITER → 403", async () => {
    mockSession("VENUE_OWNER", "o-1");
    const res = await GET();
    expect(res.status).toBe(403);
  });

  it("unauthenticated → 403", async () => {
    mockNoSession();
    const res = await GET();
    expect(res.status).toBe(403);
  });

  it("passport not found → 404", async () => {
    vi.mocked(db.waiterPassport.findUnique).mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(404);
  });

  it("active subscription returns correct tier", async () => {
    const res = await GET();
    const json = await res.json();
    expect(json.tier).toBe("PRO");
    expect(json.isActive).toBe(true);
  });

  it("active subscription returns positive daysRemaining", async () => {
    const res = await GET();
    const json = await res.json();
    expect(json.daysRemaining).toBeGreaterThan(0);
  });

  it("expired subscription returns tier FREE and isActive false", async () => {
    vi.mocked(db.waiterPassport.findUnique).mockResolvedValue({
      passportTier: "PRO",
      subscriptionExpiresAt: PAST,
    } as never);
    const res = await GET();
    const json = await res.json();
    expect(json.tier).toBe("FREE");
    expect(json.isActive).toBe(false);
    expect(json.daysRemaining).toBe(0);
  });

  it("FREE tier with no expiry returns isActive false and 0 daysRemaining", async () => {
    vi.mocked(db.waiterPassport.findUnique).mockResolvedValue({
      passportTier: "FREE",
      subscriptionExpiresAt: null,
    } as never);
    const res = await GET();
    const json = await res.json();
    expect(json.tier).toBe("FREE");
    expect(json.isActive).toBe(false);
    expect(json.daysRemaining).toBe(0);
  });

  it("response includes subscriptionExpiresAt", async () => {
    const res = await GET();
    const json = await res.json();
    expect(json).toHaveProperty("subscriptionExpiresAt");
  });
});
