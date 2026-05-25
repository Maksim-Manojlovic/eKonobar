import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth/config", () => ({ authOptions: {} }));
vi.mock("@/lib/core/db", () => ({
  db: {
    shiftSwapRequest: { findUnique: vi.fn(), update: vi.fn() },
    shiftAssignment:  { delete: vi.fn(), create: vi.fn() },
    shift:            { update: vi.fn() },
    $transaction:     vi.fn(),
  },
}));
vi.mock("@/lib/notifications/notify", () => ({ notify: vi.fn().mockResolvedValue(undefined) }));

import { getServerSession } from "next-auth";
import { db } from "@/lib/core/db";
import { notify } from "@/lib/notifications/notify";
import { PATCH } from "../route";

const SWAP_ID     = "swap-1";
const SHIFT_ID    = "shift-1";
const OWNER_ID    = "owner-1";
const FROM_WAITER = "waiter-from";
const TO_WAITER   = "waiter-to";

const BASE_SWAP = {
  id: SWAP_ID,
  status: "PENDING",
  shiftId: SHIFT_ID,
  fromAssignmentId: "assign-from",
  toWaiterId: TO_WAITER,
  shift: {
    id: SHIFT_ID,
    title: "Evening shift",
    venue: { ownerId: OWNER_ID, headWaiterId: null },
    assignments: [{ waiterId: FROM_WAITER }],
  },
  fromAssignment: { id: "assign-from", waiterId: FROM_WAITER },
};

function makeReq(body: object) {
  return new NextRequest(`http://localhost/api/shifts/swaps/${SWAP_ID}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeCtx() {
  return { params: Promise.resolve({ swapId: SWAP_ID }) };
}

function mockSession(role = "VENUE_OWNER", id = OWNER_ID) {
  vi.mocked(getServerSession).mockResolvedValue({ user: { id, role } } as never);
}

describe("PATCH /api/shifts/swaps/[swapId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession();
    vi.mocked(db.shiftSwapRequest.findUnique).mockResolvedValue(BASE_SWAP as never);
    vi.mocked(db.shiftSwapRequest.update).mockResolvedValue({} as never);
    vi.mocked(db.shiftAssignment.delete).mockResolvedValue({} as never);
    vi.mocked(db.shiftAssignment.create).mockResolvedValue({ id: "assign-new" } as never);
    vi.mocked(db.shift.update).mockResolvedValue({} as never);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(db.$transaction).mockImplementation((ops: any) => Promise.all(ops));
  });

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);
    const res = await PATCH(makeReq({ action: "ACCEPTED" }), makeCtx());
    expect(res.status).toBe(401);
  });

  it("returns 403 when role is HEADHUNTER", async () => {
    mockSession("HEADHUNTER", "hh-1");
    const res = await PATCH(makeReq({ action: "ACCEPTED" }), makeCtx());
    expect(res.status).toBe(403);
  });

  it("returns 400 when action is invalid", async () => {
    const res = await PATCH(makeReq({ action: "APPROVE" }), makeCtx());
    expect(res.status).toBe(400);
  });

  it("returns 404 when swap not found", async () => {
    vi.mocked(db.shiftSwapRequest.findUnique).mockResolvedValue(null);
    const res = await PATCH(makeReq({ action: "ACCEPTED" }), makeCtx());
    expect(res.status).toBe(404);
  });

  it("returns 403 when user is not owner or headwaiter", async () => {
    mockSession("VENUE_OWNER", "other-owner");
    const res = await PATCH(makeReq({ action: "ACCEPTED" }), makeCtx());
    expect(res.status).toBe(403);
  });

  it("allows headwaiter to resolve swap", async () => {
    vi.mocked(db.shiftSwapRequest.findUnique).mockResolvedValue({
      ...BASE_SWAP,
      shift: { ...BASE_SWAP.shift, venue: { ownerId: OWNER_ID, headWaiterId: "hw-1" } },
    } as never);
    mockSession("WAITER", "hw-1");
    const res = await PATCH(makeReq({ action: "REJECTED" }), makeCtx());
    expect(res.status).toBe(200);
  });

  it("returns 409 when swap is no longer pending", async () => {
    vi.mocked(db.shiftSwapRequest.findUnique).mockResolvedValue({
      ...BASE_SWAP, status: "ACCEPTED",
    } as never);
    const res = await PATCH(makeReq({ action: "ACCEPTED" }), makeCtx());
    expect(res.status).toBe(409);
  });

  it("returns 409 when toWaiter already on shift (ACCEPTED)", async () => {
    vi.mocked(db.shiftSwapRequest.findUnique).mockResolvedValue({
      ...BASE_SWAP,
      shift: {
        ...BASE_SWAP.shift,
        assignments: [{ waiterId: FROM_WAITER }, { waiterId: TO_WAITER }],
      },
    } as never);
    const res = await PATCH(makeReq({ action: "ACCEPTED" }), makeCtx());
    expect(res.status).toBe(409);
  });

  it("ACCEPTED: runs 4-op transaction and notifies both waiters", async () => {
    const res = await PATCH(makeReq({ action: "ACCEPTED" }), makeCtx());
    expect(res.status).toBe(200);
    const d = await res.json();
    expect(d.ok).toBe(true);

    expect(db.$transaction).toHaveBeenCalled();
    expect(db.shiftAssignment.delete).toHaveBeenCalledWith({ where: { id: "assign-from" } });
    expect(db.shiftAssignment.create).toHaveBeenCalledWith({ data: { shiftId: SHIFT_ID, waiterId: TO_WAITER } });

    await new Promise((r) => setTimeout(r, 0));
    const notifyCalls = vi.mocked(notify).mock.calls.map(c => c[0]);
    expect(notifyCalls).toContain(FROM_WAITER);
    expect(notifyCalls).toContain(TO_WAITER);
  });

  it("REJECTED: runs 2-op transaction and notifies from-waiter only", async () => {
    const res = await PATCH(makeReq({ action: "REJECTED" }), makeCtx());
    expect(res.status).toBe(200);

    expect(db.shiftAssignment.delete).not.toHaveBeenCalled();

    await new Promise((r) => setTimeout(r, 0));
    const notifyCalls = vi.mocked(notify).mock.calls.map(c => c[0]);
    expect(notifyCalls).toContain(FROM_WAITER);
    expect(notifyCalls).not.toContain(TO_WAITER);
  });
});
