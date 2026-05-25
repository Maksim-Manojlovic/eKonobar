import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  dbRaw: {
    review: { updateMany: vi.fn() },
  },
}));

import { dbRaw } from "@/lib/db";
import { publishDueReviews } from "../review-lifecycle";

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
