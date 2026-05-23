import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/db", () => ({
  db: {
    shift:            { findUnique: vi.fn() },
    user:             { findUnique: vi.fn() },
    shiftSwapRequest: { create: vi.fn(), findFirst: vi.fn() },
    $transaction:     vi.fn(),
  },
}));
vi.mock("@/lib/notify", () => ({ notify: vi.fn().mockResolvedValue(undefined) }));

import { getServerSession } from "next-auth";
import { db } from "@/lib/db";
import { POST } from "../route";

const SHIFT_ID     = "shift-1";
const OWNER_ID     = "owner-1";
const FROM_WAITER  = "waiter-from";
const TO_WAITER    = "waiter-to";

const BASE_SHIFT = {
  id: SHIFT_ID,
  title: "Evening shift",
  scheduledStart: new Date(Date.now() + 60 * 60 * 1000), // 1 hour from now
  status: "ASSIGNED",
  swapLocked: false,
  venue: { ownerId: OWNER_ID, name: "Test Venue" },
  assignments: [{ id: "assign-1", waiterId: FROM_WAITER }],
};

function makeReq(body: object) {
  return new NextRequest(`http://localhost/api/shifts/${SHIFT_ID}/swap`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeCtx() {
  return { params: Promise.resolve({ id: SHIFT_ID }) };
}

function mockSession(role = "WAITER", id = FROM_WAITER) {
  vi.mocked(getServerSession).mockResolvedValue({ user: { id, role, name: "From Waiter" } } as never);
}

function mockTransaction(result: unknown, shouldConflict = false) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  vi.mocked(db.$transaction).mockImplementation(async (fn: (tx: any) => Promise<unknown>) => {
    if (shouldConflict) {
      const err = Object.assign(new Error("conflict"), { code: "CONFLICT" });
      throw err;
    }
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue(undefined),
      shiftSwapRequest: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue(result),
      },
      shift: { update: vi.fn().mockResolvedValue(undefined) },
    };
    return fn(tx);
  });
}

describe("POST /api/shifts/[id]/swap", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession();
    vi.mocked(db.shift.findUnique).mockResolvedValue(BASE_SHIFT as never);
    vi.mocked(db.user.findUnique).mockResolvedValue({ id: TO_WAITER, role: "WAITER" } as never);
    mockTransaction({ id: "swap-1", shiftId: SHIFT_ID, fromAssignmentId: "assign-1", toWaiterId: TO_WAITER });
  });

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);
    const res = await POST(makeReq({ toWaiterId: TO_WAITER }), makeCtx());
    expect(res.status).toBe(401);
  });

  it("returns 403 when role is not WAITER", async () => {
    mockSession("VENUE_OWNER");
    const res = await POST(makeReq({ toWaiterId: TO_WAITER }), makeCtx());
    expect(res.status).toBe(403);
  });

  it("returns 400 when toWaiterId missing", async () => {
    const res = await POST(makeReq({}), makeCtx());
    expect(res.status).toBe(400);
  });

  it("returns 404 when shift not found", async () => {
    vi.mocked(db.shift.findUnique).mockResolvedValue(null);
    const res = await POST(makeReq({ toWaiterId: TO_WAITER }), makeCtx());
    expect(res.status).toBe(404);
  });

  it("returns 409 when swap is locked", async () => {
    vi.mocked(db.shift.findUnique).mockResolvedValue({ ...BASE_SHIFT, swapLocked: true } as never);
    const res = await POST(makeReq({ toWaiterId: TO_WAITER }), makeCtx());
    expect(res.status).toBe(409);
    const d = await res.json();
    expect(d.error).toMatch(/blokirane/i);
  });

  it("returns 409 when shift already started", async () => {
    vi.mocked(db.shift.findUnique).mockResolvedValue({
      ...BASE_SHIFT,
      scheduledStart: new Date(Date.now() - 10 * 60 * 1000), // 10 min ago
    } as never);
    const res = await POST(makeReq({ toWaiterId: TO_WAITER }), makeCtx());
    expect(res.status).toBe(409);
    const d = await res.json();
    expect(d.error).toMatch(/počela/i);
  });

  it("returns 403 when requesting waiter is not assigned to shift", async () => {
    vi.mocked(db.shift.findUnique).mockResolvedValue({
      ...BASE_SHIFT,
      assignments: [{ id: "assign-2", waiterId: "someone-else" }],
    } as never);
    const res = await POST(makeReq({ toWaiterId: TO_WAITER }), makeCtx());
    expect(res.status).toBe(403);
  });

  it("returns 404 when target waiter not found", async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue(null);
    const res = await POST(makeReq({ toWaiterId: "ghost-id" }), makeCtx());
    expect(res.status).toBe(404);
  });

  it("returns 409 when pending swap already exists", async () => {
    mockTransaction(null, true); // simulate CONFLICT throw
    const res = await POST(makeReq({ toWaiterId: TO_WAITER }), makeCtx());
    expect(res.status).toBe(409);
    const d = await res.json();
    expect(d.error).toMatch(/zahtev.*već postoji/i);
  });

  it("creates swap request and returns 201 on success", async () => {
    const res = await POST(makeReq({ toWaiterId: TO_WAITER }), makeCtx());
    expect(res.status).toBe(201);
    const d = await res.json();
    expect(d.id).toBe("swap-1");
  });
});
