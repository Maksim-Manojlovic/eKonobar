import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth/config", () => ({ authOptions: {} }));
vi.mock("@/lib/core/db", () => ({
  db: {
    shift:            { findUnique: vi.fn() },
    shiftAssignment:  { update: vi.fn() },
  },
}));
vi.mock("@/lib/notifications/notify", () => ({ notify: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/geo/geofence", () => ({
  isInsideVenueRadius:    vi.fn(),
  parseGuestCoordinates:  vi.fn(),
}));

import { getServerSession } from "next-auth";
import { db } from "@/lib/core/db";
import { isInsideVenueRadius, parseGuestCoordinates } from "@/lib/geo/geofence";
import { POST } from "../route";

const SHIFT_ID  = "shift-1";
const OWNER_ID  = "owner-1";
const WAITER_ID = "waiter-1";

// Scheduled 5 min from now — sits inside the ±15/+60 min window
const SCHED_IN_WINDOW = new Date(Date.now() + 5 * 60 * 1000);

const BASE_ASSIGNMENT = { id: "assign-1", waiterId: WAITER_ID, clockInAt: null, pendingClockIn: false };

const BASE_SHIFT = {
  id: SHIFT_ID,
  title: "Evening shift",
  scheduledStart: SCHED_IN_WINDOW,
  status: "ASSIGNED",
  swapLocked: false,
  venue: {
    latitude: 44.8176, longitude: 20.4633,
    reviewRadiusKm: 0.15,
    geofenceEnabled: true,
    ownerId: OWNER_ID,
    name: "Test Venue",
  },
  assignments: [BASE_ASSIGNMENT],
};

function makeReq(body: object) {
  return new NextRequest(`http://localhost/api/shifts/${SHIFT_ID}/clockin`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeCtx() {
  return { params: Promise.resolve({ id: SHIFT_ID }) };
}

function mockSession(role = "WAITER", id = WAITER_ID) {
  vi.mocked(getServerSession).mockResolvedValue({ user: { id, role, name: "Test Waiter" } } as never);
}

describe("POST /api/shifts/[id]/clockin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession();
    vi.mocked(db.shift.findUnique).mockResolvedValue(BASE_SHIFT as never);
    vi.mocked(db.shiftAssignment.update).mockResolvedValue({ id: "assign-1" } as never);
    // Default: no GPS coords
    vi.mocked(parseGuestCoordinates).mockReturnValue(null);
  });

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);
    const res = await POST(makeReq({ method: "GPS" }), makeCtx());
    expect(res.status).toBe(401);
  });

  it("returns 403 when role is not WAITER", async () => {
    mockSession("VENUE_OWNER");
    const res = await POST(makeReq({ method: "GPS" }), makeCtx());
    expect(res.status).toBe(403);
  });

  it("returns 404 when shift not found", async () => {
    vi.mocked(db.shift.findUnique).mockResolvedValue(null);
    const res = await POST(makeReq({ method: "GPS" }), makeCtx());
    expect(res.status).toBe(404);
  });

  it("returns 403 when waiter has no assignment on shift", async () => {
    vi.mocked(db.shift.findUnique).mockResolvedValue({ ...BASE_SHIFT, assignments: [] } as never);
    const res = await POST(makeReq({ method: "GPS" }), makeCtx());
    expect(res.status).toBe(403);
  });

  it("returns 409 when already clocked in", async () => {
    vi.mocked(db.shift.findUnique).mockResolvedValue({
      ...BASE_SHIFT,
      assignments: [{ ...BASE_ASSIGNMENT, clockInAt: new Date() }],
    } as never);
    const res = await POST(makeReq({ method: "GPS" }), makeCtx());
    expect(res.status).toBe(409);
    const d = await res.json();
    expect(d.error).toMatch(/čekirani/i);
  });

  it("returns 409 when approval already pending", async () => {
    vi.mocked(db.shift.findUnique).mockResolvedValue({
      ...BASE_SHIFT,
      assignments: [{ ...BASE_ASSIGNMENT, pendingClockIn: true }],
    } as never);
    const res = await POST(makeReq({ method: "GPS" }), makeCtx());
    expect(res.status).toBe(409);
    const d = await res.json();
    expect(d.error).toMatch(/čeka odobrenje/i);
  });

  it("returns 409 when too early (> 15 min before start)", async () => {
    vi.mocked(db.shift.findUnique).mockResolvedValue({
      ...BASE_SHIFT,
      scheduledStart: new Date(Date.now() + 30 * 60 * 1000), // 30 min away
    } as never);
    const res = await POST(makeReq({ method: "QR" }), makeCtx());
    expect(res.status).toBe(409);
  });

  it("returns 409 when clock-in window expired (> 60 min after start)", async () => {
    vi.mocked(db.shift.findUnique).mockResolvedValue({
      ...BASE_SHIFT,
      scheduledStart: new Date(Date.now() - 90 * 60 * 1000), // 90 min ago
    } as never);
    const res = await POST(makeReq({ method: "QR" }), makeCtx());
    expect(res.status).toBe(409);
  });

  it("approves QR without any GPS check", async () => {
    const res = await POST(makeReq({ method: "QR" }), makeCtx());
    expect(res.status).toBe(200);
    const call = vi.mocked(db.shiftAssignment.update).mock.calls[0][0];
    expect(call.data.clockInMethod).toBe("QR");
    expect(isInsideVenueRadius).not.toHaveBeenCalled();
  });

  it("approves GPS within 50m strict zone", async () => {
    vi.mocked(parseGuestCoordinates).mockReturnValue({ lat: 44.8176, lon: 20.4633 });
    vi.mocked(isInsideVenueRadius).mockReturnValueOnce({ allowed: true, distanceKm: 0.02, radiusKm: 0.05 });

    const res = await POST(makeReq({ method: "GPS", latitude: 44.8176, longitude: 20.4633 }), makeCtx());
    expect(res.status).toBe(200);
    const call = vi.mocked(db.shiftAssignment.update).mock.calls[0][0];
    expect(call.data.clockInMethod).toBe("GPS");
  });

  it("approves GPS_GRACE for 50–150m distance", async () => {
    vi.mocked(parseGuestCoordinates).mockReturnValue({ lat: 44.818, lon: 20.464 });
    vi.mocked(isInsideVenueRadius)
      .mockReturnValueOnce({ allowed: false, distanceKm: 0.08, radiusKm: 0.05 })  // strict fail
      .mockReturnValueOnce({ allowed: true,  distanceKm: 0.08, radiusKm: 0.15 }); // grace pass

    const res = await POST(makeReq({ method: "GPS", latitude: 44.818, longitude: 20.464 }), makeCtx());
    expect(res.status).toBe(200);
    const call = vi.mocked(db.shiftAssignment.update).mock.calls[0][0];
    expect(call.data.clockInMethod).toBe("GPS_GRACE");
  });

  it("returns 202 pending when GPS > 150m", async () => {
    vi.mocked(parseGuestCoordinates).mockReturnValue({ lat: 44.85, lon: 20.50 });
    vi.mocked(isInsideVenueRadius)
      .mockReturnValueOnce({ allowed: false, distanceKm: 0.5, radiusKm: 0.05 })  // strict
      .mockReturnValueOnce({ allowed: false, distanceKm: 0.5, radiusKm: 0.15 }); // grace

    const res = await POST(makeReq({ method: "GPS", latitude: 44.85, longitude: 20.50 }), makeCtx());
    expect(res.status).toBe(202);
    const d = await res.json();
    expect(d.pending).toBe(true);
  });

  it("returns 202 pending when GPS coords missing", async () => {
    vi.mocked(parseGuestCoordinates).mockReturnValue(null);
    const res = await POST(makeReq({ method: "GPS" }), makeCtx());
    expect(res.status).toBe(202);
    const d = await res.json();
    expect(d.pending).toBe(true);
  });

  it("auto-approves GPS when geofencing is disabled regardless of distance", async () => {
    vi.mocked(db.shift.findUnique).mockResolvedValue({
      ...BASE_SHIFT,
      venue: { ...BASE_SHIFT.venue, geofenceEnabled: false },
    } as never);
    vi.mocked(parseGuestCoordinates).mockReturnValue({ lat: 44.9, lon: 20.6 }); // far away

    const res = await POST(makeReq({ method: "GPS", latitude: 44.9, longitude: 20.6 }), makeCtx());
    expect(res.status).toBe(200);
    expect(isInsideVenueRadius).not.toHaveBeenCalled();
  });

  it("records lateMinutes when clocking in after scheduled start", async () => {
    const twentyMinAgo = new Date(Date.now() - 20 * 60 * 1000);
    vi.mocked(db.shift.findUnique).mockResolvedValue({
      ...BASE_SHIFT,
      scheduledStart: twentyMinAgo,
    } as never);

    await POST(makeReq({ method: "QR" }), makeCtx());

    const call = vi.mocked(db.shiftAssignment.update).mock.calls[0][0];
    expect(call.data.lateMinutes).toBeGreaterThanOrEqual(19);
    expect(call.data.lateMinutes).toBeLessThanOrEqual(21);
  });
});
