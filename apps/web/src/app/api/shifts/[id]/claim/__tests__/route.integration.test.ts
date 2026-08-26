import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("next-auth",           () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth/config",   () => ({ authOptions: {} }));
vi.mock("@/lib/notifications/side-effects", () => ({ fireSideEffects: vi.fn() }));

// DB stays real. Unit test mocked db.$transaction, so:
//   - ShiftAssignment row creation was never verified
//   - shift.status transition was never verified
//   - Race condition (two waiters for last slot) was impossible to surface

import { getServerSession } from "next-auth";
import { resetDb, seedUser } from "@/tests/integration/db-reset";
import { dbRaw } from "@/lib/core/db";
import { POST } from "../route";

// ── Helpers ───────────────────────────────────────────────────────────────────

function mockSession(id: string, name = "Test Waiter") {
  vi.mocked(getServerSession).mockResolvedValue({
    user: { id, role: "WAITER", name },
  } as never);
}

function makeReq() {
  return new NextRequest("http://localhost/api/shifts/x/claim", { method: "POST" });
}

function makeCtx(id: string) {
  return { params: Promise.resolve({ id }) };
}

async function createScaffold(requiredCount = 1) {
  const ownerId  = await seedUser({ role: "VENUE_OWNER" });
  const waiterId = await seedUser({ role: "WAITER" });

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
      venueId:       venue.id,
      title:         "Evening shift",
      date:          new Date(),
      startTime:     "18:00",
      endTime:       "02:00",
      scheduledStart: new Date(Date.now() + 60 * 60 * 1000),
      status:        "OPEN",
      requiredCount,
    },
  });

  return { ownerId, waiterId, venueId: venue.id, shiftId: shift.id };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

beforeEach(async () => {
  await resetDb();
  vi.clearAllMocks();
});

describe("POST /api/shifts/[id]/claim — integration", () => {

  // ── Resource guards ─────────────────────────────────────────────────────────

  it("nonexistent shift → 404", async () => {
    const { waiterId } = await createScaffold();
    mockSession(waiterId);
    const res = await POST(makeReq(), makeCtx("nonexistent-id"));
    expect(res.status).toBe(404);
  });

  it("non-OPEN shift → 409", async () => {
    const { waiterId, shiftId } = await createScaffold();
    await dbRaw.shift.update({ where: { id: shiftId }, data: { status: "ASSIGNED" } });
    mockSession(waiterId);
    const res = await POST(makeReq(), makeCtx(shiftId));
    expect(res.status).toBe(409);
  });

  // ── Happy path — real $transaction ──────────────────────────────────────────

  it("claim OPEN shift: ShiftAssignment created + shift → ASSIGNED (requiredCount=1)", async () => {
    const { waiterId, shiftId } = await createScaffold(1);
    mockSession(waiterId);

    const res = await POST(makeReq(), makeCtx(shiftId));
    expect(res.status).toBe(201);

    // ShiftAssignment row exists (was always mocked away before)
    const assignment = await dbRaw.shiftAssignment.findUnique({
      where: { shiftId_waiterId: { shiftId, waiterId } },
    });
    expect(assignment).not.toBeNull();

    // Shift transitioned to ASSIGNED
    const shift = await dbRaw.shift.findUnique({ where: { id: shiftId } });
    expect(shift!.status).toBe("ASSIGNED");
  });

  it("claim with 1 of 2 slots filled: shift stays OPEN", async () => {
    const { waiterId, shiftId } = await createScaffold(2);
    mockSession(waiterId);

    const res = await POST(makeReq(), makeCtx(shiftId));
    expect(res.status).toBe(201);

    const shift = await dbRaw.shift.findUnique({ where: { id: shiftId } });
    expect(shift!.status).toBe("OPEN"); // only 1 of 2 filled
  });

  it("second claim fills requiredCount=2 shift → ASSIGNED", async () => {
    const { waiterId, shiftId } = await createScaffold(2);
    const waiter2Id = await seedUser({ role: "WAITER" });

    // First claim
    mockSession(waiterId);
    await POST(makeReq(), makeCtx(shiftId));

    // Second claim fills it
    mockSession(waiter2Id);
    const res = await POST(makeReq(), makeCtx(shiftId));
    expect(res.status).toBe(201);

    const shift = await dbRaw.shift.findUnique({ where: { id: shiftId } });
    expect(shift!.status).toBe("ASSIGNED");

    const assignments = await dbRaw.shiftAssignment.findMany({ where: { shiftId } });
    expect(assignments).toHaveLength(2);
  });

  it("$transaction atomic: both ShiftAssignment and shift.status committed together", async () => {
    const { waiterId, shiftId } = await createScaffold(1);
    mockSession(waiterId);

    await POST(makeReq(), makeCtx(shiftId));

    // Both sides of the transaction must be present — not just one
    const [assignment, shift] = await Promise.all([
      dbRaw.shiftAssignment.findUnique({ where: { shiftId_waiterId: { shiftId, waiterId } } }),
      dbRaw.shift.findUnique({ where: { id: shiftId } }),
    ]);
    expect(assignment).not.toBeNull();
    expect(shift!.status).toBe("ASSIGNED");
  });

  // ── Double-claim guards ─────────────────────────────────────────────────────

  it("same waiter double-claim → 409 on second request", async () => {
    const { waiterId, shiftId } = await createScaffold(2); // requiredCount=2 so shift stays OPEN
    mockSession(waiterId);

    await POST(makeReq(), makeCtx(shiftId));                // first — succeeds
    const res = await POST(makeReq(), makeCtx(shiftId));    // second — 409
    expect(res.status).toBe(409);

    // Only one assignment row (route check prevents second DB write)
    const rows = await dbRaw.shiftAssignment.findMany({ where: { shiftId, waiterId } });
    expect(rows).toHaveLength(1);
  });

  it("claiming a full shift → 409", async () => {
    const { shiftId } = await createScaffold(1);
    const w1 = await seedUser({ role: "WAITER" });
    const w2 = await seedUser({ role: "WAITER" });

    // Fill it
    mockSession(w1);
    await POST(makeReq(), makeCtx(shiftId));

    // Second waiter tries when it's ASSIGNED
    mockSession(w2);
    const res = await POST(makeReq(), makeCtx(shiftId));
    expect(res.status).toBe(409);
  });

  // ── Race condition note ────────────────────────────────────────────────────
  // vi.mocked(getServerSession) is not safe for concurrent calls — the last
  // mockSession() call wins for all in-flight requests. True concurrent
  // different-waiter races are therefore not testable via this mock pattern.
  //
  // Known architectural risk: the route reads assignments.length OUTSIDE the
  // $transaction. Two different waiters can both pass the count check and both
  // claim a 1-person slot (overclaim). Same-waiter concurrent claims are safe
  // at the DB level via @@unique([shiftId, waiterId]); that constraint fires
  // inside the transaction and the route returns 500 (no try-catch) rather
  // than a clean 409. Fixing both would require SELECT ... FOR UPDATE inside
  // the transaction — logged here as a known gap, not tested, to avoid
  // introducing flaky concurrent-mock tests.
});
