import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/db", () => ({
  db: {
    review: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));
vi.mock("@/lib/side-effects", () => ({ fireSideEffects: vi.fn() }));

import { getServerSession } from "next-auth";
import { db } from "@/lib/db";
import { fireSideEffects } from "@/lib/side-effects";
import { PATCH } from "../route";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeReq(body: object, id = "review-1") {
  return new NextRequest(`http://localhost/api/reviews/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeCtx(id = "review-1") {
  return { params: Promise.resolve({ id }) };
}

function mockSession(role = "VENUE_OWNER", id = "owner-1") {
  vi.mocked(getServerSession).mockResolvedValue({
    user: { id, role },
  } as ReturnType<typeof getServerSession> extends Promise<infer T> ? T : never);
}

const BASE_REVIEW = {
  id: "review-1",
  status: "PENDING",
  direction: "WAITER_TO_VENUE",
  venueId: "venue-1",
  subjectId: null,
  venue: { ownerId: "owner-1" },
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("PATCH /api/reviews/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.review.update).mockResolvedValue({} as never);
  });

  // ── Auth / role guards ────────────────────────────────────────────────────

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);
    const res = await PATCH(makeReq({ action: "approve" }), makeCtx());
    expect(res.status).toBe(401);
  });

  it("returns 403 when role is WAITER", async () => {
    mockSession("WAITER");
    const res = await PATCH(makeReq({ action: "approve" }), makeCtx());
    expect(res.status).toBe(403);
  });

  it("returns 403 when role is HEADHUNTER", async () => {
    mockSession("HEADHUNTER");
    const res = await PATCH(makeReq({ action: "approve" }), makeCtx());
    expect(res.status).toBe(403);
  });

  // ── Input validation ──────────────────────────────────────────────────────

  it("returns 400 for unknown action", async () => {
    mockSession();
    vi.mocked(db.review.findUnique).mockResolvedValue(BASE_REVIEW as never);
    const res = await PATCH(makeReq({ action: "publish" }), makeCtx());
    expect(res.status).toBe(400);
  });

  // ── Resource guards ───────────────────────────────────────────────────────

  it("returns 404 when review does not exist", async () => {
    mockSession();
    vi.mocked(db.review.findUnique).mockResolvedValue(null);
    const res = await PATCH(makeReq({ action: "approve" }), makeCtx());
    expect(res.status).toBe(404);
  });

  it("returns 403 when session user does not own the venue", async () => {
    mockSession("VENUE_OWNER", "different-owner");
    vi.mocked(db.review.findUnique).mockResolvedValue(BASE_REVIEW as never);
    const res = await PATCH(makeReq({ action: "approve" }), makeCtx());
    expect(res.status).toBe(403);
  });

  it("returns 400 when review is already PUBLISHED", async () => {
    mockSession();
    vi.mocked(db.review.findUnique).mockResolvedValue({
      ...BASE_REVIEW, status: "PUBLISHED",
    } as never);
    const res = await PATCH(makeReq({ action: "approve" }), makeCtx());
    expect(res.status).toBe(400);
  });

  it("returns 400 when review is REMOVED", async () => {
    mockSession();
    vi.mocked(db.review.findUnique).mockResolvedValue({
      ...BASE_REVIEW, status: "REMOVED",
    } as never);
    const res = await PATCH(makeReq({ action: "reject" }), makeCtx());
    expect(res.status).toBe(400);
  });

  // ── Approve ───────────────────────────────────────────────────────────────

  it("approve: sets status PUBLISHED with publishedAt", async () => {
    mockSession();
    vi.mocked(db.review.findUnique).mockResolvedValue(BASE_REVIEW as never);
    const res = await PATCH(makeReq({ action: "approve" }), makeCtx());
    expect(res.status).toBe(200);
    expect(db.review.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "review-1" },
        data: expect.objectContaining({ status: "PUBLISHED", publishedAt: expect.any(Date) }),
      }),
    );
  });

  it("approve WAITER_TO_VENUE: triggers venue score sync", async () => {
    mockSession();
    vi.mocked(db.review.findUnique).mockResolvedValue(BASE_REVIEW as never);
    await PATCH(makeReq({ action: "approve" }), makeCtx());
    expect(fireSideEffects).toHaveBeenCalledWith({ syncVenueId: "venue-1", syncWaiterId: null });
  });

  it("approve GUEST_TO_VENUE: triggers venue score sync", async () => {
    mockSession();
    vi.mocked(db.review.findUnique).mockResolvedValue({
      ...BASE_REVIEW, direction: "GUEST_TO_VENUE",
    } as never);
    await PATCH(makeReq({ action: "approve" }), makeCtx());
    expect(fireSideEffects).toHaveBeenCalledWith({ syncVenueId: "venue-1", syncWaiterId: null });
  });

  it("approve GUEST_TO_WAITER: triggers passport score sync", async () => {
    mockSession();
    vi.mocked(db.review.findUnique).mockResolvedValue({
      ...BASE_REVIEW,
      direction: "GUEST_TO_WAITER",
      subjectId: "waiter-1",
    } as never);
    await PATCH(makeReq({ action: "approve" }), makeCtx());
    expect(fireSideEffects).toHaveBeenCalledWith({ syncVenueId: null, syncWaiterId: "waiter-1" });
  });

  // ── Reject ────────────────────────────────────────────────────────────────

  it("reject: sets status REMOVED", async () => {
    mockSession();
    vi.mocked(db.review.findUnique).mockResolvedValue(BASE_REVIEW as never);
    const res = await PATCH(makeReq({ action: "reject" }), makeCtx());
    expect(res.status).toBe(200);
    expect(db.review.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: "REMOVED" },
      }),
    );
  });

  it("reject: does not trigger any score sync", async () => {
    mockSession();
    vi.mocked(db.review.findUnique).mockResolvedValue(BASE_REVIEW as never);
    await PATCH(makeReq({ action: "reject" }), makeCtx());
    expect(fireSideEffects).not.toHaveBeenCalled();
  });
});
