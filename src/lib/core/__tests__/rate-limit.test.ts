import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/core/db", () => ({
  dbRaw: {
    $queryRaw:      vi.fn(),
    anonRateLimit:  { deleteMany: vi.fn() },
  },
}));

import { dbRaw } from "@/lib/core/db";
import { rateLimit, resetRateLimit, checkRateLimit } from "../rate-limit";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const raw = dbRaw as any;

describe("rateLimit (anon/pre-auth)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("count <= max -> returns true (allowed)", async () => {
    vi.mocked(raw.$queryRaw).mockResolvedValue([{ count: BigInt(1) }]);
    const result = await rateLimit("forgot:1.2.3.4", 3, 15 * 60 * 1000);
    expect(result).toBe(true);
  });

  it("count === max -> returns true (still allowed)", async () => {
    vi.mocked(raw.$queryRaw).mockResolvedValue([{ count: BigInt(3) }]);
    const result = await rateLimit("forgot:1.2.3.4", 3, 15 * 60 * 1000);
    expect(result).toBe(true);
  });

  it("count > max -> returns false (blocked)", async () => {
    vi.mocked(raw.$queryRaw).mockResolvedValue([{ count: BigInt(4) }]);
    const result = await rateLimit("forgot:1.2.3.4", 3, 15 * 60 * 1000);
    expect(result).toBe(false);
  });

  it("uses $queryRaw (raw SQL upsert)", async () => {
    vi.mocked(raw.$queryRaw).mockResolvedValue([{ count: BigInt(1) }]);
    await rateLimit("test-key", 5, 60000);
    expect(vi.mocked(raw.$queryRaw)).toHaveBeenCalledTimes(1);
  });
});

describe("resetRateLimit", () => {
  beforeEach(() => vi.clearAllMocks());

  it("deletes all entries for key", async () => {
    vi.mocked(raw.anonRateLimit.deleteMany).mockResolvedValue({ count: 2 });
    await resetRateLimit("forgot:1.2.3.4");
    expect(vi.mocked(raw.anonRateLimit.deleteMany)).toHaveBeenCalledWith({
      where: { key: "forgot:1.2.3.4" },
    });
  });
});

describe("checkRateLimit (post-auth)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("count <= max -> true (allowed)", async () => {
    vi.mocked(raw.$queryRaw).mockResolvedValue([{ count: BigInt(5) }]);
    const result = await checkRateLimit("u-1", "post_review", 5);
    expect(result).toBe(true);
  });

  it("count > max -> false (blocked)", async () => {
    vi.mocked(raw.$queryRaw).mockResolvedValue([{ count: BigInt(6) }]);
    const result = await checkRateLimit("u-1", "post_review", 5);
    expect(result).toBe(false);
  });

  it("uses $queryRaw", async () => {
    vi.mocked(raw.$queryRaw).mockResolvedValue([{ count: BigInt(1) }]);
    await checkRateLimit("u-1", "apply_job", 10);
    expect(vi.mocked(raw.$queryRaw)).toHaveBeenCalledTimes(1);
  });

  it("defaults to 1-hour window", async () => {
    vi.mocked(raw.$queryRaw).mockResolvedValue([{ count: BigInt(1) }]);
    await checkRateLimit("u-1", "post_review", 5); // no 4th arg
    expect(vi.mocked(raw.$queryRaw)).toHaveBeenCalledTimes(1);
  });
});
