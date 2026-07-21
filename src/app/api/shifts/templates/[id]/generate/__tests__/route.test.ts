import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth/config", () => ({ authOptions: {} }));
vi.mock("@/lib/core/db", () => ({
  db: {
    shiftTemplate: { findFirst: vi.fn() },
    shift:         { findMany: vi.fn(), createMany: vi.fn() },
    // Coverage notices on generated dates (empty roster by default).
    venueStaff:    { findMany: vi.fn().mockResolvedValue([]) },
    leaveRequest:  { findMany: vi.fn().mockResolvedValue([]) },
  },
}));
vi.mock("@/lib/shifts/utils", () => ({ computeScheduledStart: vi.fn().mockReturnValue(new Date()) }));

import { getServerSession } from "next-auth";
import { db } from "@/lib/core/db";
import { POST } from "../route";

const TEMPLATE_ID = "tpl-1";
const OWNER_ID    = "owner-1";

// Use a static date — resolve day-of-week dynamically to be timezone-safe.
// The route uses new Date("YYYY-MM-DD").getDay() (local time), so we mirror that here.
const TEST_DATE = "2025-07-07";
const TEST_DOW  = new Date(TEST_DATE).getDay(); // same logic as route's cursor.getDay()
const OTHER_DOW = (TEST_DOW + 1) % 7;           // guaranteed non-match

const BASE_TEMPLATE = {
  id: TEMPLATE_ID,
  venueId: "venue-1",
  name: "Evening shift",
  startTime: "18:00",
  endTime:   "02:00",
  requiredCount: 2,
  weekdaysOnly: false,
  dayOfWeek: TEST_DOW,
  role: null,
  pay: null,
};

function makeReq(body: object) {
  return new NextRequest(`http://localhost/api/shifts/templates/${TEMPLATE_ID}/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeCtx() {
  return { params: Promise.resolve({ id: TEMPLATE_ID }) };
}

function mockSession(role = "VENUE_OWNER", id = OWNER_ID) {
  vi.mocked(getServerSession).mockResolvedValue({ user: { id, role } } as never);
}

describe("POST /api/shifts/templates/[id]/generate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession();
    vi.mocked(db.shiftTemplate.findFirst).mockResolvedValue(BASE_TEMPLATE as never);
    vi.mocked(db.shift.findMany).mockResolvedValue([] as never);
    vi.mocked(db.shift.createMany).mockResolvedValue({ count: 1 } as never);
  });

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);
    const res = await POST(makeReq({ fromDate: TEST_DATE, toDate: TEST_DATE }), makeCtx());
    expect(res.status).toBe(401);
  });

  it("returns 403 when role is HEADHUNTER", async () => {
    mockSession("HEADHUNTER", "hh-1");
    const res = await POST(makeReq({ fromDate: TEST_DATE, toDate: TEST_DATE }), makeCtx());
    expect(res.status).toBe(403);
  });

  it("returns 400 when fromDate missing", async () => {
    const res = await POST(makeReq({ toDate: TEST_DATE }), makeCtx());
    expect(res.status).toBe(400);
  });

  it("returns 400 when toDate missing", async () => {
    const res = await POST(makeReq({ fromDate: TEST_DATE }), makeCtx());
    expect(res.status).toBe(400);
  });

  it("returns 404 when template not found or not owned", async () => {
    vi.mocked(db.shiftTemplate.findFirst).mockResolvedValue(null);
    const res = await POST(makeReq({ fromDate: TEST_DATE, toDate: TEST_DATE }), makeCtx());
    expect(res.status).toBe(404);
  });

  it("returns 400 when date range exceeds 90 days", async () => {
    const res = await POST(makeReq({ fromDate: "2025-01-01", toDate: "2025-04-15" }), makeCtx());
    expect(res.status).toBe(400);
  });

  it("returns { created: 0, skipped: 0 } when no days match", async () => {
    vi.mocked(db.shiftTemplate.findFirst).mockResolvedValue({
      ...BASE_TEMPLATE, weekdaysOnly: false, dayOfWeek: OTHER_DOW,
    } as never);
    const res = await POST(makeReq({ fromDate: TEST_DATE, toDate: TEST_DATE }), makeCtx());
    expect(res.status).toBe(200);
    const d = await res.json();
    expect(d.created).toBe(0);
    expect(d.skipped).toBe(0);
    expect(db.shift.createMany).not.toHaveBeenCalled();
  });

  it("creates shift when day matches dayOfWeek", async () => {
    const res = await POST(makeReq({ fromDate: TEST_DATE, toDate: TEST_DATE }), makeCtx());
    expect(res.status).toBe(200);
    const d = await res.json();
    expect(d.created).toBe(1);
    expect(d.skipped).toBe(0);
    expect(db.shift.createMany).toHaveBeenCalled();
  });

  it("skips existing dates (idempotency)", async () => {
    vi.mocked(db.shift.findMany).mockResolvedValue([{ date: new Date(TEST_DATE) }] as never);
    const res = await POST(makeReq({ fromDate: TEST_DATE, toDate: TEST_DATE }), makeCtx());
    expect(res.status).toBe(200);
    const d = await res.json();
    expect(d.created).toBe(0);
    expect(d.skipped).toBe(1);
    expect(db.shift.createMany).not.toHaveBeenCalled();
  });

  it("weekdaysOnly skips weekends", async () => {
    vi.mocked(db.shiftTemplate.findFirst).mockResolvedValue({
      ...BASE_TEMPLATE, weekdaysOnly: true,
    } as never);
    const res = await POST(makeReq({ fromDate: TEST_DATE, toDate: TEST_DATE }), makeCtx());
    expect(res.status).toBe(200);
    const d = await res.json();
    // If TEST_DATE is a weekday (dow 1-5), it should be created; if weekend, skipped
    if (TEST_DOW >= 1 && TEST_DOW <= 5) {
      expect(d.created).toBe(1);
    } else {
      expect(d.created).toBe(0);
      expect(d.skipped).toBe(0);
    }
  });

  it("createMany data includes required fields", async () => {
    await POST(makeReq({ fromDate: TEST_DATE, toDate: TEST_DATE }), makeCtx());
    const call = vi.mocked(db.shift.createMany).mock.calls[0][0];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const item = (call.data as any[])[0];
    expect(item.venueId).toBe("venue-1");
    expect(item.templateId).toBe(TEMPLATE_ID);
    expect(item.startTime).toBe("18:00");
    expect(item.endTime).toBe("02:00");
    expect(item.status).toBe("OPEN");
    expect(item.requiredCount).toBe(2);
  });
});
