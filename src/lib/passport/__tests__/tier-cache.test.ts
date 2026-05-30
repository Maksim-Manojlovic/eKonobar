import { describe, it, expect, vi, beforeEach } from "vitest";

const mockRedis = vi.hoisted(() => ({
  get:  vi.fn(),
  set:  vi.fn().mockResolvedValue("OK"),
  del:  vi.fn().mockResolvedValue(1),
}));

vi.mock("@/lib/core/redis", () => ({ redis: mockRedis }));

vi.mock("@/lib/core/db", () => ({
  db: {
    waiterPassport: { findUnique: vi.fn() },
  },
}));

vi.mock("@/lib/passport/tier", () => ({
  getEffectiveTier: vi.fn(),
}));

import { db } from "@/lib/core/db";
import { getEffectiveTier } from "@/lib/passport/tier";
import { getEffectiveTierCached, bustTierCache } from "../tier-cache";

const USER_ID = "user-1";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getEffectiveTierCached", () => {
  it("returns cached tier without DB call on hit", async () => {
    mockRedis.get.mockResolvedValue("PRO");

    const tier = await getEffectiveTierCached(USER_ID);

    expect(tier).toBe("PRO");
    expect(db.waiterPassport.findUnique).not.toHaveBeenCalled();
    expect(mockRedis.get).toHaveBeenCalledWith(`passport:tier:${USER_ID}`);
  });

  it("falls through to DB on cache miss and writes result", async () => {
    mockRedis.get.mockResolvedValue(null);
    vi.mocked(db.waiterPassport.findUnique).mockResolvedValue({
      passportTier: "PRO_PLUS",
      subscriptionExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    } as never);
    vi.mocked(getEffectiveTier).mockReturnValue("PRO_PLUS");

    const tier = await getEffectiveTierCached(USER_ID);

    expect(tier).toBe("PRO_PLUS");
    expect(db.waiterPassport.findUnique).toHaveBeenCalledOnce();
    expect(mockRedis.set).toHaveBeenCalledWith(
      `passport:tier:${USER_ID}`,
      "PRO_PLUS",
      "EX",
      expect.any(Number),
    );
  });

  it("TTL is capped at 3600s for active subscriptions", async () => {
    mockRedis.get.mockResolvedValue(null);
    const farFuture = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000); // 90 days
    vi.mocked(db.waiterPassport.findUnique).mockResolvedValue({
      passportTier: "PRO",
      subscriptionExpiresAt: farFuture,
    } as never);
    vi.mocked(getEffectiveTier).mockReturnValue("PRO");

    await getEffectiveTierCached(USER_ID);

    const [, , , ttl] = vi.mocked(mockRedis.set).mock.calls[0];
    expect(ttl).toBe(3600);
  });

  it("uses 300s TTL for FREE tier (no expiry)", async () => {
    mockRedis.get.mockResolvedValue(null);
    vi.mocked(db.waiterPassport.findUnique).mockResolvedValue({
      passportTier: "FREE",
      subscriptionExpiresAt: null,
    } as never);
    vi.mocked(getEffectiveTier).mockReturnValue("FREE");

    await getEffectiveTierCached(USER_ID);

    const [, , , ttl] = vi.mocked(mockRedis.set).mock.calls[0];
    expect(ttl).toBe(300);
  });

  it("falls back to DB on Redis error and returns correct tier", async () => {
    mockRedis.get.mockRejectedValue(new Error("connection refused"));
    vi.mocked(db.waiterPassport.findUnique).mockResolvedValue({
      passportTier: "FREE",
      subscriptionExpiresAt: null,
    } as never);
    vi.mocked(getEffectiveTier).mockReturnValue("FREE");

    const tier = await getEffectiveTierCached(USER_ID);

    expect(tier).toBe("FREE");
    expect(db.waiterPassport.findUnique).toHaveBeenCalledOnce();
  });
});

describe("bustTierCache", () => {
  it("deletes the Redis key", () => {
    bustTierCache(USER_ID);
    expect(mockRedis.del).toHaveBeenCalledWith(`passport:tier:${USER_ID}`);
  });
});
