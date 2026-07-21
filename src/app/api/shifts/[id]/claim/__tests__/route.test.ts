import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth/config", () => ({ authOptions: {} }));
vi.mock("@/lib/core/db", () => ({
  db: {
    shift:           { findUnique: vi.fn(), update: vi.fn() },
    shiftAssignment: { create: vi.fn() },
    // Claim is hard-blocked when the waiter has approved leave that day.
    leaveRequest:    { findFirst: vi.fn().mockResolvedValue(null) },
    $transaction:    vi.fn(),
  },
}));
vi.mock("@/lib/notifications/side-effects", () => ({ fireSideEffects: vi.fn() }));

import { getServerSession } from "next-auth";
import { db } from "@/lib/core/db";
import { fireSideEffects } from "@/lib/notifications/side-effects";
import { POST } from "../route";

const SHIFT_ID  = "shift-1";
const OWNER_ID  = "owner-1";
const WAITER_ID = "waiter-1";

const BASE_SHIFT = {
  id: SHIFT_ID,
  title: "Morning shift",
  status: "OPEN",
  requiredCount: 2,
  assignments: [],
  venue: { ownerId: OWNER_ID, name: "Test Venue" },
};

function makeReq() {
  return new NextRequest(`http://localhost/api/shifts/${SHIFT_ID}/claim`, { method: "POST" });
}

function makeCtx() {
  return { params: Promise.resolve({ id: SHIFT_ID }) };
}

function mockSession(role = "WAITER", id = WAITER_ID) {
  vi.mocked(getServerSession).mockResolvedValue({ user: { id, role, name: "Test Waiter" } } as never);
}

describe("POST /api/shifts/[id]/claim", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession();
    vi.mocked(db.shift.findUnique).mockResolvedValue(BASE_SHIFT as never);
    vi.mocked(db.shiftAssignment.create).mockResolvedValue({ id: "assign-new" } as never);
    vi.mocked(db.shift.update).mockResolvedValue({} as never);
    // clearAllMocks keeps implementations, so a per-test override would leak.
    vi.mocked(db.leaveRequest.findFirst).mockResolvedValue(null as never);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(db.$transaction).mockImplementation((ops: any) => Promise.all(ops));
  });

  it("returns 409 when the waiter has approved leave that day", async () => {
    // Hard block: a worker must not book themselves onto a day they have off.
    // The manager-side assign path only warns.
    vi.mocked(db.leaveRequest.findFirst).mockResolvedValue({ id: "leave-1" } as never);

    const res = await POST(makeReq(), makeCtx());
    expect(res.status).toBe(409);
    expect((await res.json()).error).toContain("odsustvo");
    expect(db.shiftAssignment.create).not.toHaveBeenCalled();
  });

  it("checks leave against the shift date", async () => {
    const shiftDate = new Date("2026-08-12T00:00:00Z");
    vi.mocked(db.shift.findUnique).mockResolvedValue({ ...BASE_SHIFT, date: shiftDate } as never);

    await POST(makeReq(), makeCtx());
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where = (vi.mocked(db.leaveRequest.findFirst).mock.calls[0][0] as any).where;
    expect(where.waiterId).toBe(WAITER_ID);
    expect(where.status).toBe("APPROVED");
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

  it("returns 409 when shift is not OPEN", async () => {
    vi.mocked(db.shift.findUnique).mockResolvedValue({ ...BASE_SHIFT, status: "ASSIGNED" } as never);
    const res = await POST(makeReq(), makeCtx());
    expect(res.status).toBe(409);
    const d = await res.json();
    expect(d.error).toMatch(/dostupna/i);
  });

  it("returns 409 when waiter already assigned", async () => {
    vi.mocked(db.shift.findUnique).mockResolvedValue({
      ...BASE_SHIFT,
      assignments: [{ waiterId: WAITER_ID }],
    } as never);
    const res = await POST(makeReq(), makeCtx());
    expect(res.status).toBe(409);
    const d = await res.json();
    expect(d.error).toMatch(/već ste/i);
  });

  it("returns 409 when shift is full", async () => {
    vi.mocked(db.shift.findUnique).mockResolvedValue({
      ...BASE_SHIFT,
      requiredCount: 1,
      assignments: [{ waiterId: "other-waiter" }],
    } as never);
    const res = await POST(makeReq(), makeCtx());
    expect(res.status).toBe(409);
    const d = await res.json();
    expect(d.error).toMatch(/popunjena/i);
  });

  it("creates assignment and returns 201", async () => {
    const res = await POST(makeReq(), makeCtx());
    expect(res.status).toBe(201);
  });

  it("sets shift status ASSIGNED when filling the last slot", async () => {
    vi.mocked(db.shift.findUnique).mockResolvedValue({
      ...BASE_SHIFT,
      requiredCount: 2,
      assignments: [{ waiterId: "other-waiter" }],
    } as never);
    await POST(makeReq(), makeCtx());
    const updateCall = vi.mocked(db.shift.update).mock.calls[0][0];
    expect(updateCall.data.status).toBe("ASSIGNED");
  });

  it("keeps shift status OPEN when more slots remain", async () => {
    vi.mocked(db.shift.findUnique).mockResolvedValue({
      ...BASE_SHIFT,
      requiredCount: 3,
      assignments: [{ waiterId: "other-waiter" }],
    } as never);
    await POST(makeReq(), makeCtx());
    const updateCall = vi.mocked(db.shift.update).mock.calls[0][0];
    expect(updateCall.data.status).toBe("OPEN");
  });

  it("notifies venue owner after claim", async () => {
    await POST(makeReq(), makeCtx());
    expect(fireSideEffects).toHaveBeenCalledWith(
      expect.objectContaining({
        notifications: expect.arrayContaining([
          expect.objectContaining({ userId: OWNER_ID, type: "SHIFT_CLAIMED" }),
        ]),
      }),
    );
  });
});
