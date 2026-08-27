import { describe, it, expect, vi, beforeEach } from "vitest";

// Redis mock — simulates a connected Redis instance.
const mockRedis = vi.hoisted(() => ({
  get: vi.fn(),
  set: vi.fn().mockResolvedValue("OK"),
}));

vi.mock("@/lib/core/redis", () => ({ redis: mockRedis }));

vi.mock("@/lib/core/db", () => ({
  dbRaw: {
    tokenRevocation: { findUnique: vi.fn() },
  },
}));

import { dbRaw } from "@/lib/core/db";
import { isTokenRevoked, REV_CACHE_TTL_MS, REV_CACHE_TTL_ADMIN_MS } from "../revocation";

const USER_ID   = "user-redis-1";
const TOKEN_IAT = 1_000_000;
const REVOKED_AT_SEC = TOKEN_IAT + 10;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("isTokenRevoked — Redis path", () => {
  it("returns false from Redis when cached as 'none' — no DB call", async () => {
    mockRedis.get.mockResolvedValue("none");

    const result = await isTokenRevoked(USER_ID, TOKEN_IAT);

    expect(result).toBe(false);
    expect(dbRaw.tokenRevocation.findUnique).not.toHaveBeenCalled();
  });

  it("returns true from Redis when token was issued before revocation — no DB call", async () => {
    mockRedis.get.mockResolvedValue(String(REVOKED_AT_SEC));

    const result = await isTokenRevoked(USER_ID, TOKEN_IAT);

    expect(result).toBe(true);
    expect(dbRaw.tokenRevocation.findUnique).not.toHaveBeenCalled();
  });

  it("returns false from Redis when token was issued after revocation — no DB call", async () => {
    // Token iat is after revokedAt — user re-logged in since the ban
    mockRedis.get.mockResolvedValue(String(TOKEN_IAT - 5));

    const result = await isTokenRevoked(USER_ID, TOKEN_IAT);

    expect(result).toBe(false);
    expect(dbRaw.tokenRevocation.findUnique).not.toHaveBeenCalled();
  });

  it("queries DB on cache miss and writes 'none' sentinel to Redis", async () => {
    mockRedis.get.mockResolvedValue(null);
    vi.mocked(dbRaw.tokenRevocation.findUnique).mockResolvedValue(null);

    const result = await isTokenRevoked(USER_ID, TOKEN_IAT);

    expect(result).toBe(false);
    expect(dbRaw.tokenRevocation.findUnique).toHaveBeenCalledOnce();
    expect(mockRedis.set).toHaveBeenCalledWith(
      `token:rev:${USER_ID}`,
      "none",
      "EX",
      expect.any(Number),
    );
  });

  it("queries DB on cache miss and writes revokedAt to Redis", async () => {
    mockRedis.get.mockResolvedValue(null);
    vi.mocked(dbRaw.tokenRevocation.findUnique).mockResolvedValue({
      revokedAt: new Date(REVOKED_AT_SEC * 1000),
    } as never);

    const result = await isTokenRevoked(USER_ID, TOKEN_IAT);

    expect(result).toBe(true);
    expect(mockRedis.set).toHaveBeenCalledWith(
      `token:rev:${USER_ID}`,
      String(REVOKED_AT_SEC),
      "EX",
      expect.any(Number),
    );
  });

  it("uses 5s TTL for ADMIN role", async () => {
    mockRedis.get.mockResolvedValue(null);
    vi.mocked(dbRaw.tokenRevocation.findUnique).mockResolvedValue(null);

    await isTokenRevoked(USER_ID, TOKEN_IAT, "ADMIN");

    const [, , , ttl] = vi.mocked(mockRedis.set).mock.calls[0];
    expect(ttl).toBe(REV_CACHE_TTL_ADMIN_MS / 1000);
  });

  it("uses 60s TTL for non-ADMIN role", async () => {
    mockRedis.get.mockResolvedValue(null);
    vi.mocked(dbRaw.tokenRevocation.findUnique).mockResolvedValue(null);

    await isTokenRevoked(USER_ID, TOKEN_IAT, "WAITER");

    const [, , , ttl] = vi.mocked(mockRedis.set).mock.calls[0];
    expect(ttl).toBe(REV_CACHE_TTL_MS / 1000);
  });

  it("falls back to DB when Redis.get throws", async () => {
    mockRedis.get.mockRejectedValue(new Error("Redis timeout"));
    vi.mocked(dbRaw.tokenRevocation.findUnique).mockResolvedValue(null);

    const result = await isTokenRevoked(USER_ID, TOKEN_IAT);

    expect(result).toBe(false);
    expect(dbRaw.tokenRevocation.findUnique).toHaveBeenCalledOnce();
  });
});
