import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/db", () => ({
  db: {
    shift: { update: vi.fn(), delete: vi.fn() },
    user:  { findMany: vi.fn() },
  },
}));
vi.mock("@/lib/shift-auth", () => ({ getManagedShift: vi.fn() }));
vi.mock("@/lib/shift-utils", () => ({ computeScheduledStart: vi.fn(() => new Date("2025-06-15T18:00:00Z")) }));
vi.mock("@/lib/logger", () => ({ default: { error: vi.fn() } }));

import { getServerSession } from "next-auth";
import { db } from "@/lib/db";
import { getManagedShift } from "@/lib/shift-auth";
import { PATCH, DELETE } from "../route";

const OWNER_ID = "owner-1";
const SHIFT_ID  = "shift-1";

const BASE_SHIFT = {
  id: SHIFT_ID,
  title: "Evening",
  date: new Date("2025-06-15"),
  startTime: "18:00",
  endTime:   "02:00",
  requiredCount: 2,
  status: "OPEN",
  venue: { id: "v-1", ownerId: OWNER_ID, headWaiterId: null },
  assignments: [],
};

function makeCtx(id = SHIFT_ID) {
  return { params: Promise.resolve({ id }) };
}

function makeReq(body: object, method = "PATCH") {
  return new NextRequest(`http://localhost/api/shifts/${SHIFT_ID}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function mockSession(role = "VENUE_OWNER", id = OWNER_ID) {
  vi.mocked(getServerSession).mockResolvedValue({ user: { id, role } } as never);
}

function mockNoSession() {
  vi.mocked(getServerSession).mockResolvedValue(null);
}

describe("PATCH /api/shifts/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession();
    vi.mocked(getManagedShift).mockResolvedValue(BASE_SHIFT as never);
    vi.mocked(db.shift.update).mockResolvedValue({ id: SHIFT_ID, title: "Updated" } as never);
    vi.mocked(db.user.findMany).mockResolvedValue([] as never);
  });

  it("owner patches title → 200", async () => {
    const res = await PATCH(makeReq({ title: "Morning" }), makeCtx());
    expect(res.status).toBe(200);
    expect(vi.mocked(db.shift.update)).toHaveBeenCalledOnce();
  });

  it("unauthenticated → 401", async () => {
    mockNoSession();
    const res = await PATCH(makeReq({ title: "x" }), makeCtx());
    expect(res.status).toBe(401);
  });

  it("HEADHUNTER role → 403", async () => {
    mockSession("HEADHUNTER", "h-1");
    const res = await PATCH(makeReq({ title: "x" }), makeCtx());
    expect(res.status).toBe(403);
  });

  it("shift not found → 404", async () => {
    vi.mocked(getManagedShift).mockResolvedValue(null);
    const res = await PATCH(makeReq({ title: "x" }), makeCtx());
    expect(res.status).toBe(404);
  });

  it("waiterIds with valid waiters → updates assignments", async () => {
    const WAITER_ID = "w-1";
    vi.mocked(db.user.findMany).mockResolvedValue([{ id: WAITER_ID }] as never);

    const res = await PATCH(makeReq({ waiterIds: [WAITER_ID] }), makeCtx());
    expect(res.status).toBe(200);
    expect(vi.mocked(db.shift.update)).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          assignments: expect.objectContaining({ deleteMany: {} }),
        }),
      }),
    );
  });

  it("waiterIds with unknown waiter → 404", async () => {
    // findMany returns fewer users than provided IDs
    vi.mocked(db.user.findMany).mockResolvedValue([] as never);
    const res = await PATCH(makeReq({ waiterIds: ["ghost-id"] }), makeCtx());
    expect(res.status).toBe(404);
  });

  it("waiterIds count >= requiredCount → status becomes ASSIGNED", async () => {
    const shift = { ...BASE_SHIFT, requiredCount: 1 };
    vi.mocked(getManagedShift).mockResolvedValue(shift as never);
    vi.mocked(db.user.findMany).mockResolvedValue([{ id: "w-1" }] as never);

    await PATCH(makeReq({ waiterIds: ["w-1"] }), makeCtx());

    expect(vi.mocked(db.shift.update)).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "ASSIGNED" }),
      }),
    );
  });

  it("waiterIds count < requiredCount → status becomes OPEN", async () => {
    const shift = { ...BASE_SHIFT, requiredCount: 3 };
    vi.mocked(getManagedShift).mockResolvedValue(shift as never);
    vi.mocked(db.user.findMany).mockResolvedValue([{ id: "w-1" }] as never);

    await PATCH(makeReq({ waiterIds: ["w-1"] }), makeCtx());

    expect(vi.mocked(db.shift.update)).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "OPEN" }),
      }),
    );
  });

  it("explicit status not overridden by waiterIds derivation", async () => {
    vi.mocked(db.user.findMany).mockResolvedValue([{ id: "w-1" }] as never);

    await PATCH(makeReq({ waiterIds: ["w-1"], status: "PENDING_SWAP" }), makeCtx());

    expect(vi.mocked(db.shift.update)).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "PENDING_SWAP" }),
      }),
    );
  });

  it("WAITER with head-waiter access → allowed", async () => {
    mockSession("WAITER", "hw-1");
    const shift = { ...BASE_SHIFT, venue: { ...BASE_SHIFT.venue, headWaiterId: "hw-1" } };
    vi.mocked(getManagedShift).mockResolvedValue(shift as never);

    const res = await PATCH(makeReq({ notes: "brief" }), makeCtx());
    expect(res.status).toBe(200);
  });
});

describe("DELETE /api/shifts/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession();
    vi.mocked(getManagedShift).mockResolvedValue(BASE_SHIFT as never);
    vi.mocked(db.shift.delete).mockResolvedValue(BASE_SHIFT as never);
  });

  it("owner deletes shift → 200", async () => {
    const res = await DELETE(
      new NextRequest(`http://localhost/api/shifts/${SHIFT_ID}`, { method: "DELETE" }),
      makeCtx(),
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
  });

  it("unauthenticated → 401", async () => {
    mockNoSession();
    const res = await DELETE(
      new NextRequest(`http://localhost/api/shifts/${SHIFT_ID}`, { method: "DELETE" }),
      makeCtx(),
    );
    expect(res.status).toBe(401);
  });

  it("shift not found → 404", async () => {
    vi.mocked(getManagedShift).mockResolvedValue(null);
    const res = await DELETE(
      new NextRequest(`http://localhost/api/shifts/${SHIFT_ID}`, { method: "DELETE" }),
      makeCtx(),
    );
    expect(res.status).toBe(404);
  });

  it("calls db.shift.delete with correct id", async () => {
    await DELETE(
      new NextRequest(`http://localhost/api/shifts/${SHIFT_ID}`, { method: "DELETE" }),
      makeCtx(),
    );
    expect(vi.mocked(db.shift.delete)).toHaveBeenCalledWith({ where: { id: SHIFT_ID } });
  });
});
