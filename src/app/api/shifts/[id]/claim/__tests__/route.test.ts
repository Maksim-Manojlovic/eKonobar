import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/db", () => ({
  db: {
    shift:           { findUnique: vi.fn(), update: vi.fn() },
    shiftAssignment: { create: vi.fn() },
    $transaction:    vi.fn(),
  },
}));
vi.mock("@/lib/notify", () => ({ notify: vi.fn().mockResolvedValue(undefined) }));

import { getServerSession } from "next-auth";
import { db } from "@/lib/db";
import { notify } from "@/lib/notify";
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(db.$transaction).mockImplementation((ops: any) => Promise.all(ops));
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
    await new Promise((r) => setTimeout(r, 0));
    expect(notify).toHaveBeenCalledWith(
      OWNER_ID, "SHIFT_CLAIMED", expect.any(String), expect.any(String), expect.any(String),
    );
  });
});
