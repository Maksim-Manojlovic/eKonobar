import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/db", () => ({
  db: {
    shift:  { create: vi.fn() },
    venue:  { findFirst: vi.fn() },
    user:   { findMany: vi.fn() },
  },
}));
vi.mock("@/lib/shift-utils", () => ({
  computeScheduledStart: vi.fn().mockReturnValue(new Date("2025-07-01T18:00:00Z")),
}));
vi.mock("@/lib/logger", () => ({ default: { error: vi.fn() } }));

import { getServerSession } from "next-auth";
import { db } from "@/lib/db";
import { POST } from "../route";

function makeReq(body: object) {
  return new NextRequest("http://localhost/api/shifts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function mockSession(role = "VENUE_OWNER", id = "owner-1") {
  vi.mocked(getServerSession).mockResolvedValue({
    user: { id, role },
  } as never);
}

const BASE_BODY = {
  venueId: "venue-1",
  title: "Evening shift",
  date: "2025-07-01",
  startTime: "18:00",
  endTime: "02:00",
};

const FAKE_VENUE = { id: "venue-1", ownerId: "owner-1" };

describe("POST /api/shifts — status derivation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.venue.findFirst).mockResolvedValue(FAKE_VENUE as never);
    vi.mocked(db.user.findMany).mockResolvedValue([] as never);
    vi.mocked(db.shift.create).mockImplementation(({ data }: { data: { status: string } }) =>
      Promise.resolve({ id: "s-1", ...data }) as never,
    );
  });

  it("sets status OPEN when no waiters assigned", async () => {
    mockSession();
    await POST(makeReq({ ...BASE_BODY, requiredCount: 2, waiterIds: [] }));
    const data = vi.mocked(db.shift.create).mock.calls[0]?.[0].data;
    expect(data?.status).toBe("OPEN");
  });

  it("sets status OPEN when assigned count < requiredCount", async () => {
    mockSession();
    vi.mocked(db.user.findMany).mockResolvedValue([{ id: "w1" }] as never);
    await POST(makeReq({ ...BASE_BODY, requiredCount: 3, waiterIds: ["w1"] }));
    const data = vi.mocked(db.shift.create).mock.calls[0]?.[0].data;
    expect(data?.status).toBe("OPEN");
  });

  it("sets status ASSIGNED when assigned count equals requiredCount", async () => {
    mockSession();
    vi.mocked(db.user.findMany).mockResolvedValue([{ id: "w1" }, { id: "w2" }] as never);
    await POST(makeReq({ ...BASE_BODY, requiredCount: 2, waiterIds: ["w1", "w2"] }));
    const data = vi.mocked(db.shift.create).mock.calls[0]?.[0].data;
    expect(data?.status).toBe("ASSIGNED");
  });

  it("sets status ASSIGNED when assigned count exceeds requiredCount", async () => {
    mockSession();
    vi.mocked(db.user.findMany).mockResolvedValue([{ id: "w1" }, { id: "w2" }, { id: "w3" }] as never);
    await POST(makeReq({ ...BASE_BODY, requiredCount: 2, waiterIds: ["w1", "w2", "w3"] }));
    const data = vi.mocked(db.shift.create).mock.calls[0]?.[0].data;
    expect(data?.status).toBe("ASSIGNED");
  });

  it("returns 400 when required fields missing", async () => {
    mockSession();
    const res = await POST(makeReq({ venueId: "venue-1" }));
    expect(res.status).toBe(400);
  });

  it("returns 403 when unauthenticated", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);
    const res = await POST(makeReq(BASE_BODY));
    expect(res.status).toBe(403);
  });
});
