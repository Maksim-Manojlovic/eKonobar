import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth/config", () => ({ authOptions: {} }));
vi.mock("@/lib/core/db", () => ({
  db: {
    waiterPassport: { findUnique: vi.fn(), update: vi.fn() },
  },
}));

import { getServerSession } from "next-auth";
import { db } from "@/lib/core/db";
import { POST } from "../route";
import { SUBSCRIPTION_DURATION_MS } from "@/lib/passport/constants";

const USER_ID = "waiter-1";

function makeReq(body: object) {
  return new NextRequest("http://localhost/api/passport/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function mockSession(role = "WAITER", id = USER_ID) {
  vi.mocked(getServerSession).mockResolvedValue({ user: { id, role } } as never);
}

const FUTURE_EXPIRY = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);
const PAST_EXPIRY   = new Date(Date.now() -  1 * 24 * 60 * 60 * 1000);

describe("POST /api/passport/subscribe", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession();
    vi.mocked(db.waiterPassport.findUnique).mockResolvedValue({
      passportTier: "FREE",
      subscriptionExpiresAt: null,
    } as never);
    vi.mocked(db.waiterPassport.update).mockResolvedValue({
      passportTier: "PRO",
      subscriptionExpiresAt: new Date(),
    } as never);
  });

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);
    const res = await POST(makeReq({ tier: "PRO" }), {} as never);
    expect(res.status).toBe(401);
  });

  it("returns 403 when role is not WAITER", async () => {
    mockSession("VENUE_OWNER");
    const res = await POST(makeReq({ tier: "PRO" }), {} as never);
    expect(res.status).toBe(403);
  });

  it("returns 400 for invalid tier", async () => {
    const res = await POST(makeReq({ tier: "DIAMOND" }), {} as never);
    expect(res.status).toBe(400);
    const d = await res.json();
    expect(d.error).toMatch(/invalid tier/i);
  });

  it("returns 404 when passport not found", async () => {
    vi.mocked(db.waiterPassport.findUnique).mockResolvedValue(null);
    const res = await POST(makeReq({ tier: "PRO" }), {} as never);
    expect(res.status).toBe(404);
  });

  it("clears subscription on FREE tier", async () => {
    vi.mocked(db.waiterPassport.update).mockResolvedValue({
      passportTier: "FREE",
      subscriptionExpiresAt: null,
    } as never);
    const res = await POST(makeReq({ tier: "FREE" }), {} as never);
    expect(res.status).toBe(200);
    const d = await res.json();
    expect(d.tier).toBe("FREE");
    expect(vi.mocked(db.waiterPassport.update)).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ passportTier: "FREE", subscriptionExpiresAt: null }),
      }),
    );
  });

  it("extends PRO subscription +30 days from now when no active sub", async () => {
    const before = Date.now();
    await POST(makeReq({ tier: "PRO" }), {} as never);
    const after = Date.now();
    const updateCall = vi.mocked(db.waiterPassport.update).mock.calls[0][0];
    const expiry = updateCall.data.subscriptionExpiresAt as Date;
    const thirtyDays = SUBSCRIPTION_DURATION_MS;
    expect(expiry.getTime()).toBeGreaterThanOrEqual(before + thirtyDays - 1000);
    expect(expiry.getTime()).toBeLessThanOrEqual(after  + thirtyDays + 1000);
  });

  it("extends PRO subscription from active expiry when still active", async () => {
    vi.mocked(db.waiterPassport.findUnique).mockResolvedValue({
      passportTier: "PRO",
      subscriptionExpiresAt: FUTURE_EXPIRY,
    } as never);
    await POST(makeReq({ tier: "PRO" }), {} as never);
    const updateCall = vi.mocked(db.waiterPassport.update).mock.calls[0][0];
    const expiry = updateCall.data.subscriptionExpiresAt as Date;
    const thirtyDays = SUBSCRIPTION_DURATION_MS;
    expect(Math.abs(expiry.getTime() - (FUTURE_EXPIRY.getTime() + thirtyDays))).toBeLessThan(1000);
  });

  it("extends from now when subscription is expired", async () => {
    vi.mocked(db.waiterPassport.findUnique).mockResolvedValue({
      passportTier: "PRO",
      subscriptionExpiresAt: PAST_EXPIRY,
    } as never);
    const before = Date.now();
    await POST(makeReq({ tier: "PRO" }), {} as never);
    const after = Date.now();
    const updateCall = vi.mocked(db.waiterPassport.update).mock.calls[0][0];
    const expiry = updateCall.data.subscriptionExpiresAt as Date;
    const thirtyDays = SUBSCRIPTION_DURATION_MS;
    expect(expiry.getTime()).toBeGreaterThanOrEqual(before + thirtyDays - 1000);
    expect(expiry.getTime()).toBeLessThanOrEqual(after  + thirtyDays + 1000);
  });

  it("sets tierRank 1 for PRO", async () => {
    await POST(makeReq({ tier: "PRO" }), {} as never);
    const updateCall = vi.mocked(db.waiterPassport.update).mock.calls[0][0];
    expect(updateCall.data.tierRank).toBe(1);
  });

  it("sets tierRank 2 for PRO_PLUS", async () => {
    vi.mocked(db.waiterPassport.update).mockResolvedValue({
      passportTier: "PRO_PLUS",
      subscriptionExpiresAt: new Date(),
    } as never);
    await POST(makeReq({ tier: "PRO_PLUS" }), {} as never);
    const updateCall = vi.mocked(db.waiterPassport.update).mock.calls[0][0];
    expect(updateCall.data.tierRank).toBe(2);
  });

  it("returns tier, subscriptionExpiresAt, and priceRsd in response", async () => {
    const expiry = new Date();
    vi.mocked(db.waiterPassport.update).mockResolvedValue({
      passportTier: "PRO",
      subscriptionExpiresAt: expiry,
    } as never);
    const res = await POST(makeReq({ tier: "PRO" }), {} as never);
    expect(res.status).toBe(200);
    const d = await res.json();
    expect(d.tier).toBe("PRO");
    expect(d.subscriptionExpiresAt).toBeDefined();
    expect(d.priceRsd).toBe(290);
  });

  it("returns priceRsd 490 for PRO_PLUS", async () => {
    vi.mocked(db.waiterPassport.update).mockResolvedValue({
      passportTier: "PRO_PLUS",
      subscriptionExpiresAt: new Date(),
    } as never);
    const res = await POST(makeReq({ tier: "PRO_PLUS" }), {} as never);
    const d = await res.json();
    expect(d.priceRsd).toBe(490);
  });
});
