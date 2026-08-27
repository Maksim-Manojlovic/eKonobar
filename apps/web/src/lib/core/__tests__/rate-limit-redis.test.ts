import { describe, it, expect, vi, beforeEach } from "vitest";

// Redis mock — simulates a connected Redis instance.
const mockRedis = vi.hoisted(() => ({
  incr:    vi.fn(),
  pexpire: vi.fn().mockResolvedValue(1),
  scan:    vi.fn().mockResolvedValue(["0", []]),
}));

vi.mock("@/lib/core/redis", () => ({ redis: mockRedis }));

vi.mock("@/lib/core/db", () => ({
  dbRaw: {
    $queryRaw:     vi.fn(),
    anonRateLimit: { deleteMany: vi.fn() },
    rateLimit:     { upsert: vi.fn() },
  },
}));

import { dbRaw } from "@/lib/core/db";
import { rateLimit, resetRateLimit, checkRateLimit } from "../rate-limit";

beforeEach(() => {
  vi.clearAllMocks();
});

// ── rateLimit (anonymous) ──────────────────────────────────────────────────────

describe("rateLimit — Redis path", () => {
  it("returns true when count <= max", async () => {
    mockRedis.incr.mockResolvedValue(1);
    expect(await rateLimit("login:ip:1.2.3.4", 3, 60_000)).toBe(true);
  });

  it("returns true at exactly max (boundary inclusive)", async () => {
    mockRedis.incr.mockResolvedValue(3);
    expect(await rateLimit("login:ip:1.2.3.4", 3, 60_000)).toBe(true);
  });

  it("returns false when count exceeds max", async () => {
    mockRedis.incr.mockResolvedValue(4);
    expect(await rateLimit("login:ip:1.2.3.4", 3, 60_000)).toBe(false);
  });

  it("sets PEXPIRE only on first increment (count === 1)", async () => {
    mockRedis.incr.mockResolvedValue(1);
    await rateLimit("first:hit", 5, 60_000);
    expect(mockRedis.pexpire).toHaveBeenCalledOnce();
  });

  it("does not call PEXPIRE on subsequent increments", async () => {
    mockRedis.incr.mockResolvedValue(2);
    await rateLimit("second:hit", 5, 60_000);
    expect(mockRedis.pexpire).not.toHaveBeenCalled();
  });

  it("does not call DB when Redis succeeds", async () => {
    mockRedis.incr.mockResolvedValue(1);
    await rateLimit("test:key", 5, 60_000);
    expect(dbRaw.$queryRaw).not.toHaveBeenCalled();
  });

  it("falls back to DB when Redis throws", async () => {
    mockRedis.incr.mockRejectedValue(new Error("connection refused"));
    vi.mocked(dbRaw.$queryRaw).mockResolvedValue([{ count: BigInt(1) }]);

    const result = await rateLimit("fallback:key", 3, 60_000);

    expect(result).toBe(true);
    expect(dbRaw.$queryRaw).toHaveBeenCalledOnce();
  });
});

// ── checkRateLimit (post-auth) ────────────────────────────────────────────────

describe("checkRateLimit — Redis path", () => {
  it("returns true when count <= max", async () => {
    mockRedis.incr.mockResolvedValue(5);
    expect(await checkRateLimit("user-1", "post_review", 5)).toBe(true);
  });

  it("returns false when count > max", async () => {
    mockRedis.incr.mockResolvedValue(6);
    expect(await checkRateLimit("user-1", "post_review", 5)).toBe(false);
  });

  it("does not call DB when Redis succeeds", async () => {
    mockRedis.incr.mockResolvedValue(1);
    await checkRateLimit("user-1", "apply_job", 10);
    expect(dbRaw.rateLimit.upsert).not.toHaveBeenCalled();
  });

  it("falls back to DB when Redis throws", async () => {
    mockRedis.incr.mockRejectedValue(new Error("Redis timeout"));
    vi.mocked(dbRaw.rateLimit.upsert).mockResolvedValue({ count: 1 } as never);

    const result = await checkRateLimit("user-1", "post_review", 5);

    expect(result).toBe(true);
    expect(dbRaw.rateLimit.upsert).toHaveBeenCalledOnce();
  });
});

// ── resetRateLimit ────────────────────────────────────────────────────────────

describe("resetRateLimit — Redis path", () => {
  it("scans and deletes matching Redis keys, then deletes DB rows", async () => {
    mockRedis.scan.mockResolvedValueOnce(["0", ["rl:forgot:1.2.3.4:1234"]]);

    await resetRateLimit("forgot:1.2.3.4");

    expect(mockRedis.scan).toHaveBeenCalled();
    expect(dbRaw.anonRateLimit.deleteMany).toHaveBeenCalledWith({
      where: { key: "forgot:1.2.3.4" },
    });
  });

  it("still deletes DB rows when no Redis keys found", async () => {
    mockRedis.scan.mockResolvedValue(["0", []]);
    await resetRateLimit("no:keys:here");
    expect(dbRaw.anonRateLimit.deleteMany).toHaveBeenCalledOnce();
  });
});
