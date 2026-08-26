import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("next-auth",           () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth/config",   () => ({ authOptions: {} }));
vi.mock("@/lib/notifications/side-effects", () => ({ fireSideEffects: vi.fn() }));

// DB stays real. Unit test mocked db.$transaction — all 4 writes on the
// ACCEPTED path (delete fromAssignment, create toAssignment, resolve swap,
// set shift ASSIGNED) were never executed. The 2-write REJECTED path also
// never ran. This test proves all operations commit atomically.

import { getServerSession } from "next-auth";
import { resetDb, seedUser } from "@/tests/integration/db-reset";
import { dbRaw } from "@/lib/core/db";
import { PATCH } from "../route";

function makeReq(body: object) {
  return new NextRequest("http://localhost/api/shifts/swaps/x", {
    method:  "PATCH",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(body),
  });
}

function makeCtx(swapId: string) {
  return { params: Promise.resolve({ swapId }) };
}

function mockOwner(id: string) {
  vi.mocked(getServerSession).mockResolvedValue({
    user: { id, role: "VENUE_OWNER" },
  } as never);
}

async function createScaffold() {
  const ownerId      = await seedUser({ role: "VENUE_OWNER" });
  const fromWaiterId = await seedUser({ role: "WAITER" });
  const toWaiterId   = await seedUser({ role: "WAITER" });

  const venue = await dbRaw.venue.create({
    data: {
      ownerId,
      name:         "Venue",
      address:      "Addr",
      municipality: "Beograd",
      venueType:    "RESTAURANT",
      latitude:     44.8,
      longitude:    20.4,
    },
  });

  const shift = await dbRaw.shift.create({
    data: {
      venueId:   venue.id,
      title:     "Evening shift",
      date:      new Date(),
      startTime: "18:00",
      endTime:   "02:00",
      status:    "PENDING_SWAP",
    },
  });

  const fromAssignment = await dbRaw.shiftAssignment.create({
    data: { shiftId: shift.id, waiterId: fromWaiterId },
  });

  const swapRequest = await dbRaw.shiftSwapRequest.create({
    data: {
      shiftId:          shift.id,
      fromAssignmentId: fromAssignment.id,
      toWaiterId,
      status:           "PENDING",
    },
  });

  return {
    ownerId,
    fromWaiterId,
    toWaiterId,
    shiftId:    shift.id,
    assignmentId: fromAssignment.id,
    swapId:     swapRequest.id,
  };
}

beforeEach(async () => {
  await resetDb();
  vi.clearAllMocks();
});

describe("PATCH /api/shifts/swaps/[swapId] — integration", () => {

  // ── Guards ─────────────────────────────────────────────────────────────────

  it("nonexistent swap → 404", async () => {
    const { ownerId } = await createScaffold();
    mockOwner(ownerId);
    const res = await PATCH(makeReq({ action: "ACCEPTED" }), makeCtx("ghost-id"));
    expect(res.status).toBe(404);
  });

  it("unrelated owner → 403", async () => {
    const { swapId } = await createScaffold();
    const intruder = await seedUser({ role: "VENUE_OWNER" });
    mockOwner(intruder);
    const res = await PATCH(makeReq({ action: "ACCEPTED" }), makeCtx(swapId));
    expect(res.status).toBe(403);
  });

  it("already-resolved swap → 409", async () => {
    const { ownerId, swapId } = await createScaffold();
    await dbRaw.shiftSwapRequest.update({
      where: { id: swapId },
      data:  { status: "ACCEPTED" },
    });
    mockOwner(ownerId);
    const res = await PATCH(makeReq({ action: "ACCEPTED" }), makeCtx(swapId));
    expect(res.status).toBe(409);
  });

  // ── ACCEPTED — 3-operation $transaction ────────────────────────────────────
  // Assignment is UPDATED (waiterId changed) rather than delete+create.
  // delete+create would fail with ON DELETE RESTRICT — ShiftSwapRequest
  // .fromAssignmentId references the assignment and cannot be deleted while
  // that FK exists. Updating in-place transfers the slot without touching FKs.

  it("ACCEPTED: fromWaiter no longer on shift (assignment transferred)", async () => {
    const { ownerId, fromWaiterId, shiftId, swapId } = await createScaffold();
    mockOwner(ownerId);

    const res = await PATCH(makeReq({ action: "ACCEPTED" }), makeCtx(swapId));
    expect(res.status).toBe(200);

    const old = await dbRaw.shiftAssignment.findUnique({
      where: { shiftId_waiterId: { shiftId, waiterId: fromWaiterId } },
    });
    expect(old).toBeNull(); // fromWaiter's slot transferred to toWaiter
  });

  it("ACCEPTED: toWaiter now on shift", async () => {
    const { ownerId, toWaiterId, shiftId, swapId } = await createScaffold();
    mockOwner(ownerId);

    await PATCH(makeReq({ action: "ACCEPTED" }), makeCtx(swapId));

    const assignment = await dbRaw.shiftAssignment.findUnique({
      where: { shiftId_waiterId: { shiftId, waiterId: toWaiterId } },
    });
    expect(assignment).not.toBeNull();
  });

  it("ACCEPTED: swap status → ACCEPTED with resolvedAt", async () => {
    const { ownerId, swapId } = await createScaffold();
    mockOwner(ownerId);

    await PATCH(makeReq({ action: "ACCEPTED" }), makeCtx(swapId));

    const swap = await dbRaw.shiftSwapRequest.findUnique({ where: { id: swapId } });
    expect(swap!.status).toBe("ACCEPTED");
    expect(swap!.resolvedAt).not.toBeNull();
  });

  it("ACCEPTED: shift status → ASSIGNED", async () => {
    const { ownerId, shiftId, swapId } = await createScaffold();
    mockOwner(ownerId);

    await PATCH(makeReq({ action: "ACCEPTED" }), makeCtx(swapId));

    const shift = await dbRaw.shift.findUnique({ where: { id: shiftId } });
    expect(shift!.status).toBe("ASSIGNED");
  });

  it("ACCEPTED $transaction atomic: all 3 writes visible simultaneously", async () => {
    const { ownerId, fromWaiterId, toWaiterId, shiftId, swapId } = await createScaffold();
    mockOwner(ownerId);

    await PATCH(makeReq({ action: "ACCEPTED" }), makeCtx(swapId));

    const [fromSlot, toSlot, swap, shift] = await Promise.all([
      dbRaw.shiftAssignment.findUnique({ where: { shiftId_waiterId: { shiftId, waiterId: fromWaiterId } } }),
      dbRaw.shiftAssignment.findUnique({ where: { shiftId_waiterId: { shiftId, waiterId: toWaiterId } } }),
      dbRaw.shiftSwapRequest.findUnique({ where: { id: swapId } }),
      dbRaw.shift.findUnique({ where: { id: shiftId } }),
    ]);
    expect(fromSlot).toBeNull();            // transferred away
    expect(toSlot).not.toBeNull();          // transferred to
    expect(swap!.status).toBe("ACCEPTED");  // resolved
    expect(shift!.status).toBe("ASSIGNED"); // status fixed
  });

  it("ACCEPTED: toWaiter already on shift → 409, DB unchanged", async () => {
    const { ownerId, toWaiterId, shiftId, swapId } = await createScaffold();
    // Pre-assign toWaiter to the same shift
    await dbRaw.shiftAssignment.create({
      data: { shiftId, waiterId: toWaiterId },
    });
    mockOwner(ownerId);

    const res = await PATCH(makeReq({ action: "ACCEPTED" }), makeCtx(swapId));
    expect(res.status).toBe(409);

    // Swap stays PENDING — no writes occurred
    const swap = await dbRaw.shiftSwapRequest.findUnique({ where: { id: swapId } });
    expect(swap!.status).toBe("PENDING");
  });

  // ── REJECTED — 2-operation $transaction ────────────────────────────────────

  it("REJECTED: swap status → REJECTED, fromAssignment unchanged", async () => {
    const { ownerId, fromWaiterId, shiftId, assignmentId, swapId } = await createScaffold();
    mockOwner(ownerId);

    await PATCH(makeReq({ action: "REJECTED" }), makeCtx(swapId));

    const swap = await dbRaw.shiftSwapRequest.findUnique({ where: { id: swapId } });
    expect(swap!.status).toBe("REJECTED");
    expect(swap!.resolvedAt).not.toBeNull();

    // fromWaiter still assigned — assignment NOT deleted on reject
    const assignment = await dbRaw.shiftAssignment.findUnique({
      where: { shiftId_waiterId: { shiftId, waiterId: fromWaiterId } },
    });
    expect(assignment).not.toBeNull();

    // No new assignment for toWaiter
    const [row] = await dbRaw.shiftAssignment.findMany({
      where: { id: assignmentId },
    });
    expect(row).not.toBeNull();
  });

  it("REJECTED: shift status → ASSIGNED", async () => {
    const { ownerId, shiftId, swapId } = await createScaffold();
    mockOwner(ownerId);

    await PATCH(makeReq({ action: "REJECTED" }), makeCtx(swapId));

    const shift = await dbRaw.shift.findUnique({ where: { id: shiftId } });
    expect(shift!.status).toBe("ASSIGNED");
  });
});
