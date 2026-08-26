import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth/config", () => ({ authOptions: {} }));
vi.mock("@/lib/core/db", () => ({
  db: {
    shiftAssignment: { findUnique: vi.fn(), update: vi.fn() },
  },
}));
vi.mock("@/lib/notifications/side-effects", () => ({ fireSideEffects: vi.fn() }));

import { getServerSession } from "next-auth";
import { db } from "@/lib/core/db";
import { fireSideEffects } from "@/lib/notifications/side-effects";
import { PATCH } from "../route";

const ASSIGN_ID = "assign-1";
const OWNER_ID  = "owner-1";
const WAITER_ID = "waiter-1";

const BASE_ASSIGNMENT = {
  id: ASSIGN_ID,
  pendingClockIn: true,
  shift: {
    title: "Evening shift",
    scheduledStart: new Date(Date.now() - 15 * 60 * 1000), // 15 min ago
    venue: { ownerId: OWNER_ID, name: "Test Venue" },
  },
  waiter: { id: WAITER_ID, name: "Test Waiter" },
};

function makeReq(body: object) {
  return new NextRequest(`http://localhost/api/shifts/assignments/${ASSIGN_ID}/approve-clockin`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeCtx() {
  return { params: Promise.resolve({ id: ASSIGN_ID }) };
}

function mockSession(role = "VENUE_OWNER", id = OWNER_ID) {
  vi.mocked(getServerSession).mockResolvedValue({ user: { id, role } } as never);
}

describe("PATCH /api/shifts/assignments/[id]/approve-clockin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession();
    vi.mocked(db.shiftAssignment.findUnique).mockResolvedValue(BASE_ASSIGNMENT as never);
    vi.mocked(db.shiftAssignment.update).mockResolvedValue({ id: ASSIGN_ID } as never);
  });

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);
    const res = await PATCH(makeReq({ action: "approve" }), makeCtx());
    expect(res.status).toBe(401);
  });

  it("returns 403 when role is not VENUE_OWNER", async () => {
    mockSession("WAITER");
    const res = await PATCH(makeReq({ action: "approve" }), makeCtx());
    expect(res.status).toBe(403);
  });

  it("returns 400 when action is invalid", async () => {
    const res = await PATCH(makeReq({ action: "whatever" }), makeCtx());
    expect(res.status).toBe(400);
  });

  it("returns 404 when assignment not found", async () => {
    vi.mocked(db.shiftAssignment.findUnique).mockResolvedValue(null);
    const res = await PATCH(makeReq({ action: "approve" }), makeCtx());
    expect(res.status).toBe(404);
  });

  it("returns 403 when owner does not own the venue", async () => {
    vi.mocked(db.shiftAssignment.findUnique).mockResolvedValue({
      ...BASE_ASSIGNMENT,
      shift: { ...BASE_ASSIGNMENT.shift, venue: { ownerId: "other-owner", name: "Other Venue" } },
    } as never);
    const res = await PATCH(makeReq({ action: "approve" }), makeCtx());
    expect(res.status).toBe(403);
  });

  it("returns 409 when no pending clock-in exists", async () => {
    vi.mocked(db.shiftAssignment.findUnique).mockResolvedValue({
      ...BASE_ASSIGNMENT,
      pendingClockIn: false,
    } as never);
    const res = await PATCH(makeReq({ action: "approve" }), makeCtx());
    expect(res.status).toBe(409);
    const d = await res.json();
    expect(d.error).toMatch(/odobrenje/i);
  });

  it("approve: sets MANUAL clock-in with lateMinutes and notifies waiter", async () => {
    const res = await PATCH(makeReq({ action: "approve" }), makeCtx());
    expect(res.status).toBe(200);

    const call = vi.mocked(db.shiftAssignment.update).mock.calls[0][0];
    expect(call.data.clockInMethod).toBe("MANUAL");
    expect(call.data.pendingClockIn).toBe(false);
    expect(call.data.clockInAt).toBeInstanceOf(Date);
    expect(call.data.lateMinutes).toBeGreaterThanOrEqual(14);

    expect(fireSideEffects).toHaveBeenCalledWith(
      expect.objectContaining({
        notifications: expect.arrayContaining([
          expect.objectContaining({ userId: WAITER_ID, type: "CLOCKIN_RESOLVED", body: expect.stringMatching(/odobrio/i) }),
        ]),
      }),
    );
  });

  it("reject: clears pendingClockIn and notifies waiter", async () => {
    const res = await PATCH(makeReq({ action: "reject" }), makeCtx());
    expect(res.status).toBe(200);

    const call = vi.mocked(db.shiftAssignment.update).mock.calls[0][0];
    expect(call.data.pendingClockIn).toBe(false);
    expect(call.data.clockInMethod).toBeUndefined();

    expect(fireSideEffects).toHaveBeenCalledWith(
      expect.objectContaining({
        notifications: expect.arrayContaining([
          expect.objectContaining({ userId: WAITER_ID, type: "CLOCKIN_RESOLVED", body: expect.stringMatching(/nije odobrio/i) }),
        ]),
      }),
    );
  });
});
