import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/core/db", () => ({
  db: {
    venue:          { findUnique: vi.fn() },
    jobApplication: { findMany: vi.fn() },
  },
}));

import { db } from "@/lib/core/db";
import { GET } from "../route";

const VENUE_ID = "venue-1";

const BASE_VENUE = {
  id: VENUE_ID,
  name: "Test Venue",
  address: "Main St 1",
  latitude: 44.8,
  longitude: 20.4,
  reviewRadiusKm: 0.15,
  geofenceEnabled: true,
  images: [],
};

const ACCEPTED_APP = {
  waiter: { id: "w-1", name: "Marko", image: null },
};

function makeCtx(id = VENUE_ID) {
  return { params: Promise.resolve({ id }) };
}

describe("GET /api/venues/[id]/public", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.venue.findUnique).mockResolvedValue(BASE_VENUE as never);
    vi.mocked(db.jobApplication.findMany).mockResolvedValue([ACCEPTED_APP] as never);
  });

  it("returns venue + accepted waiters without auth", async () => {
    const res = await GET(new NextRequest("http://localhost"), makeCtx());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.venue.id).toBe(VENUE_ID);
    expect(json.waiters).toHaveLength(1);
    expect(json.waiters[0]).toEqual(ACCEPTED_APP.waiter);
  });

  it("venue not found → 404", async () => {
    vi.mocked(db.venue.findUnique).mockResolvedValue(null);
    const res = await GET(new NextRequest("http://localhost"), makeCtx("bad-id"));
    expect(res.status).toBe(404);
  });

  it("no accepted waiters → empty array", async () => {
    vi.mocked(db.jobApplication.findMany).mockResolvedValue([]);
    const res = await GET(new NextRequest("http://localhost"), makeCtx());
    const json = await res.json();
    expect(json.waiters).toEqual([]);
  });

  it("only ACCEPTED applications queried", async () => {
    await GET(new NextRequest("http://localhost"), makeCtx());
    expect(vi.mocked(db.jobApplication.findMany)).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ status: "ACCEPTED" }) }),
    );
  });

  it("no auth required", async () => {
    // Route has no session check — confirm no getServerSession imported
    const res = await GET(new NextRequest("http://localhost"), makeCtx());
    expect(res.status).toBe(200);
  });
});
