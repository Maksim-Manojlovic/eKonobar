import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/db", () => ({
  db: {
    shift:           { findUnique: vi.fn() },
    shiftAssignment: { update: vi.fn() },
  },
}));
vi.mock("@/lib/shift-utils", () => ({ computeScheduledEnd: vi.fn() }));

import { getServerSession } from "next-auth";
import { db } from "@/lib/db";
import { computeScheduledEnd } from "@/lib/shift-utils";
import { POST } from "../route";

const SHIFT_ID  = "shift-1";
const WAITER_ID = "waiter-1";

const CLOCKED_IN_ASSIGNMENT = {
  id: "assign-1", waiterId: WAITER_ID,
  clockInAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2h ago
  clockOutAt: null,
};

const BASE_SHIFT = {
  id: SHIFT_ID,
  date: new Date("2025-07-01"),
  startTime: "18:00",
  endTime: "02:00",
  scheduledStart: new Date("2025-07-01T18:00:00Z"),
  assignments: [CLOCKED_IN_ASSIGNMENT],
};

function makeReq() {
  return new NextRequest(`http://localhost/api/shifts/${SHIFT_ID}/clockout`, {
    method: "POST",
  });
}

function makeCtx() {
  return { params: Promise.resolve({ id: SHIFT_ID }) };
}

function mockSession(role = "WAITER", id = WAITER_ID) {
  vi.mocked(getServerSession).mockResolvedValue({ user: { id, role } } as never);
}

describe("POST /api/shifts/[id]/clockout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession();
    vi.mocked(db.shift.findUnique).mockResolvedValue(BASE_SHIFT as never);
    vi.mocked(db.shiftAssignment.update).mockResolvedValue({ id: "assign-1" } as never);
    // Default: scheduled end is in the future → early exit
    vi.mocked(computeScheduledEnd).mockReturnValue(new Date(Date.now() + 60 * 60 * 1000));
  });

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);
    const res = await POST(makeReq(), makeCtx());
    expect(res.status).toBe(401);
  });

  it("returns 403 when role is not WAITER", async () => {
    mockSession("VENUE_OWNER");
    const res = await POST(makeReq(), makeCtx());
    expect(res.status).toBe(403);
  });

  it("returns 404 when shift not found", async () => {
    vi.mocked(db.shift.findUnique).mockResolvedValue(null);
    const res = await POST(makeReq(), makeCtx());
    expect(res.status).toBe(404);
  });

  it("returns 403 when waiter has no assignment", async () => {
    vi.mocked(db.shift.findUnique).mockResolvedValue({ ...BASE_SHIFT, assignments: [] } as never);
    const res = await POST(makeReq(), makeCtx());
    expect(res.status).toBe(403);
  });

  it("returns 409 when not yet clocked in", async () => {
    vi.mocked(db.shift.findUnique).mockResolvedValue({
      ...BASE_SHIFT,
      assignments: [{ ...CLOCKED_IN_ASSIGNMENT, clockInAt: null }],
    } as never);
    const res = await POST(makeReq(), makeCtx());
    expect(res.status).toBe(409);
    const d = await res.json();
    expect(d.error).toMatch(/čekirani/i);
  });

  it("returns 409 when already clocked out", async () => {
    vi.mocked(db.shift.findUnique).mockResolvedValue({
      ...BASE_SHIFT,
      assignments: [{ ...CLOCKED_IN_ASSIGNMENT, clockOutAt: new Date() }],
    } as never);
    const res = await POST(makeReq(), makeCtx());
    expect(res.status).toBe(409);
    const d = await res.json();
    expect(d.error).toMatch(/odjavili/i);
  });

  it("sets earlyExitAt when clocking out before scheduled end", async () => {
    vi.mocked(computeScheduledEnd).mockReturnValue(new Date(Date.now() + 60 * 60 * 1000));
    await POST(makeReq(), makeCtx());
    const call = vi.mocked(db.shiftAssignment.update).mock.calls[0][0];
    expect(call.data.clockOutAt).toBeInstanceOf(Date);
    expect(call.data.earlyExitAt).toBeInstanceOf(Date);
  });

  it("does not set earlyExitAt when clocking out on time", async () => {
    vi.mocked(computeScheduledEnd).mockReturnValue(new Date(Date.now() - 5 * 60 * 1000)); // ended 5 min ago
    await POST(makeReq(), makeCtx());
    const call = vi.mocked(db.shiftAssignment.update).mock.calls[0][0];
    expect(call.data.clockOutAt).toBeInstanceOf(Date);
    expect(call.data.earlyExitAt).toBeUndefined();
  });

  it("returns 200 with updated assignment on success", async () => {
    const res = await POST(makeReq(), makeCtx());
    expect(res.status).toBe(200);
  });
});
