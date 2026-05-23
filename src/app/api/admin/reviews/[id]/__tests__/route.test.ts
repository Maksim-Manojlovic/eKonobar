import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/db", () => ({
  dbRaw: {
    review: { findUnique: vi.fn(), update: vi.fn() },
  },
}));
vi.mock("@/lib/sync-scores", () => ({
  syncVenueTrustScore: vi.fn().mockResolvedValue(undefined),
  syncPassportScore:   vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/audit", () => ({ logAudit: vi.fn() }));

import { getServerSession } from "next-auth";
import { dbRaw } from "@/lib/db";
import { syncVenueTrustScore, syncPassportScore } from "@/lib/sync-scores";
import { PATCH } from "../route";

const ADMIN_ID  = "admin-1";
const REVIEW_ID = "r-1";

const BASE_REVIEW = {
  id: REVIEW_ID,
  direction: "WAITER_TO_VENUE",
  status: "DISPUTED",
  venueId: "v-1",
  subjectId: null,
};

function makeCtx(id = REVIEW_ID) {
  return { params: Promise.resolve({ id }) };
}

function makeReq(body: object) {
  return new NextRequest(`http://localhost/api/admin/reviews/${REVIEW_ID}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function mockSession(role = "ADMIN", id = ADMIN_ID) {
  vi.mocked(getServerSession).mockResolvedValue({ user: { id, role } } as never);
}

function mockNoSession() {
  vi.mocked(getServerSession).mockResolvedValue(null);
}

describe("PATCH /api/admin/reviews/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession();
    vi.mocked(dbRaw.review.findUnique).mockResolvedValue(BASE_REVIEW as never);
    vi.mocked(dbRaw.review.update).mockResolvedValue({ ...BASE_REVIEW, status: "PUBLISHED" } as never);
  });

  it("ADMIN publishes review → 200", async () => {
    const res = await PATCH(makeReq({ action: "publish" }), makeCtx());
    expect(res.status).toBe(200);
    expect(vi.mocked(dbRaw.review.update)).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "PUBLISHED" }),
      }),
    );
  });

  it("ADMIN removes review → 200", async () => {
    vi.mocked(dbRaw.review.update).mockResolvedValue({ ...BASE_REVIEW, status: "REMOVED" } as never);
    const res = await PATCH(makeReq({ action: "remove" }), makeCtx());
    expect(res.status).toBe(200);
    expect(vi.mocked(dbRaw.review.update)).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "REMOVED" }),
      }),
    );
  });

  it("non-ADMIN → 403", async () => {
    mockSession("VENUE_OWNER", "o-1");
    const res = await PATCH(makeReq({ action: "publish" }), makeCtx());
    expect(res.status).toBe(403);
  });

  it("unauthenticated → 403", async () => {
    mockNoSession();
    const res = await PATCH(makeReq({ action: "publish" }), makeCtx());
    expect(res.status).toBe(403);
  });

  it("invalid action → 400", async () => {
    const res = await PATCH(makeReq({ action: "approve" }), makeCtx());
    expect(res.status).toBe(400);
  });

  it("review not found → 404", async () => {
    vi.mocked(dbRaw.review.findUnique).mockResolvedValue(null);
    const res = await PATCH(makeReq({ action: "publish" }), makeCtx());
    expect(res.status).toBe(404);
  });

  it("publish WAITER_TO_VENUE fires syncVenueTrustScore", async () => {
    await PATCH(makeReq({ action: "publish" }), makeCtx());
    await new Promise(r => setTimeout(r, 0));

    expect(vi.mocked(syncVenueTrustScore)).toHaveBeenCalledWith("v-1");
  });

  it("publish VENUE_TO_WAITER fires syncPassportScore", async () => {
    vi.mocked(dbRaw.review.findUnique).mockResolvedValue({
      ...BASE_REVIEW,
      direction: "VENUE_TO_WAITER",
      subjectId: "w-1",
      venueId: null,
    } as never);

    await PATCH(makeReq({ action: "publish" }), makeCtx());
    await new Promise(r => setTimeout(r, 0));

    expect(vi.mocked(syncPassportScore)).toHaveBeenCalledWith("w-1");
  });

  it("remove action does not fire score sync", async () => {
    await PATCH(makeReq({ action: "remove" }), makeCtx());
    await new Promise(r => setTimeout(r, 0));

    expect(vi.mocked(syncVenueTrustScore)).not.toHaveBeenCalled();
    expect(vi.mocked(syncPassportScore)).not.toHaveBeenCalled();
  });

  it("publish sets publishedAt", async () => {
    await PATCH(makeReq({ action: "publish" }), makeCtx());

    expect(vi.mocked(dbRaw.review.update)).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ publishedAt: expect.any(Date) }),
      }),
    );
  });

  it("remove does not set publishedAt", async () => {
    await PATCH(makeReq({ action: "remove" }), makeCtx());

    const call = vi.mocked(dbRaw.review.update).mock.calls[0][0] as { data: Record<string, unknown> };
    expect(call.data.publishedAt).toBeUndefined();
  });
});
