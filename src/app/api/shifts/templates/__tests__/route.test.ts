import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/db", () => ({
  db: {
    shiftTemplate: { findMany: vi.fn(), create: vi.fn() },
    venue:         { findFirst: vi.fn() },
  },
}));

import { getServerSession } from "next-auth";
import { db } from "@/lib/db";
import { GET, POST } from "../route";

const OWNER_ID  = "owner-1";
const WAITER_ID = "waiter-1";
const VENUE_ID  = "venue-1";

const TEMPLATE = {
  id: "t-1",
  venueId: VENUE_ID,
  name: "Evening shift",
  dayOfWeek: 1,
  weekdaysOnly: false,
  startTime: "18:00",
  endTime: "02:00",
  requiredCount: 3,
};

function makePostReq(body: object) {
  return new NextRequest("http://localhost/api/shifts/templates", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const VALID_BODY = {
  venueId: VENUE_ID, name: "Evening shift",
  dayOfWeek: 1, weekdaysOnly: false,
  startTime: "18:00", endTime: "02:00",
};

function mockSession(role = "VENUE_OWNER", id = OWNER_ID) {
  vi.mocked(getServerSession).mockResolvedValue({ user: { id, role } } as never);
}

function mockNoSession() {
  vi.mocked(getServerSession).mockResolvedValue(null);
}

describe("GET /api/shifts/templates", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession();
    vi.mocked(db.shiftTemplate.findMany).mockResolvedValue([TEMPLATE] as never);
  });

  it("VENUE_OWNER gets templates → 200", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toHaveLength(1);
  });

  it("WAITER (headWaiter) gets templates → 200", async () => {
    mockSession("WAITER", WAITER_ID);
    const res = await GET();
    expect(res.status).toBe(200);
  });

  it("VENUE_OWNER query filters by ownerId", async () => {
    await GET();
    expect(vi.mocked(db.shiftTemplate.findMany)).toHaveBeenCalledWith(
      expect.objectContaining({ where: { venue: { ownerId: OWNER_ID } } }),
    );
  });

  it("WAITER query filters by headWaiterId", async () => {
    mockSession("WAITER", WAITER_ID);
    await GET();
    expect(vi.mocked(db.shiftTemplate.findMany)).toHaveBeenCalledWith(
      expect.objectContaining({ where: { venue: { headWaiterId: WAITER_ID } } }),
    );
  });

  it("HEADHUNTER → 403", async () => {
    mockSession("HEADHUNTER", "h-1");
    const res = await GET();
    expect(res.status).toBe(403);
  });

  it("unauthenticated → 401", async () => {
    mockNoSession();
    const res = await GET();
    expect(res.status).toBe(401);
  });
});

describe("POST /api/shifts/templates", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession();
    vi.mocked(db.venue.findFirst).mockResolvedValue({ id: VENUE_ID } as never);
    vi.mocked(db.shiftTemplate.create).mockResolvedValue(TEMPLATE as never);
  });

  it("VENUE_OWNER creates template → 201", async () => {
    const res = await POST(makePostReq(VALID_BODY));
    expect(res.status).toBe(201);
  });

  it("HEADHUNTER → 403", async () => {
    mockSession("HEADHUNTER", "h-1");
    const res = await POST(makePostReq(VALID_BODY));
    expect(res.status).toBe(403);
  });

  it("unauthenticated → 401", async () => {
    mockNoSession();
    const res = await POST(makePostReq(VALID_BODY));
    expect(res.status).toBe(401);
  });

  it("missing venueId → 400", async () => {
    const res = await POST(makePostReq({ ...VALID_BODY, venueId: undefined }));
    expect(res.status).toBe(400);
  });

  it("missing startTime → 400", async () => {
    const res = await POST(makePostReq({ ...VALID_BODY, startTime: undefined }));
    expect(res.status).toBe(400);
  });

  it("weekdaysOnly=false with missing dayOfWeek → 400", async () => {
    const res = await POST(makePostReq({ ...VALID_BODY, dayOfWeek: undefined }));
    expect(res.status).toBe(400);
  });

  it("weekdaysOnly=false with dayOfWeek=7 → 400", async () => {
    const res = await POST(makePostReq({ ...VALID_BODY, dayOfWeek: 7 }));
    expect(res.status).toBe(400);
  });

  it("weekdaysOnly=true with no dayOfWeek → 201", async () => {
    const res = await POST(makePostReq({ ...VALID_BODY, weekdaysOnly: true, dayOfWeek: undefined }));
    expect(res.status).toBe(201);
  });

  it("venue not found → 404", async () => {
    vi.mocked(db.venue.findFirst).mockResolvedValue(null);
    const res = await POST(makePostReq(VALID_BODY));
    expect(res.status).toBe(404);
  });
});
