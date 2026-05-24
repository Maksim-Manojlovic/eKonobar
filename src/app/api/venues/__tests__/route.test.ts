import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/db", () => ({
  db: {
    venue: { findMany: vi.fn(), create: vi.fn() },
  },
}));

import { getServerSession } from "next-auth";
import { db } from "@/lib/db";
import { GET, POST } from "../route";

const OWNER_ID = "owner-1";

const OWNER_VENUE = {
  id: "venue-1",
  name: "Test Venue",
  ownerId: OWNER_ID,
  _count: { jobPosts: 2 },
  venueTrustScore: null,
  headWaiter: null,
};

const PUBLIC_VENUE = {
  id: "venue-1",
  name: "Test Venue",
  address: "123 Main St",
  municipality: "Beograd",
  venueType: "CAFE",
  latitude: 44.8,
  longitude: 20.4,
  trustScore: 75,
};

function makeReq() { return new NextRequest("http://localhost/api/test"); }

const CTX = { params: Promise.resolve({}) };

function makePostReq(body: object) {
  return new NextRequest("http://localhost/api/venues", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function mockSession(role: string, id = OWNER_ID) {
  vi.mocked(getServerSession).mockResolvedValue({ user: { id, role } } as never);
}

function mockNoSession() {
  vi.mocked(getServerSession).mockResolvedValue(null);
}

const VALID_BODY = {
  name: "New Venue",
  address: "Knez Mihailova 1",
  municipality: "Beograd",
  venueType: "CAFE",
  latitude: 44.8,
  longitude: 20.4,
};

describe("GET /api/venues", () => {
  beforeEach(() => vi.clearAllMocks());

  it("VENUE_OWNER gets own venues with full data", async () => {
    mockSession("VENUE_OWNER");
    vi.mocked(db.venue.findMany).mockResolvedValue([OWNER_VENUE] as never);

    const res = await GET(makeReq(), CTX);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual([OWNER_VENUE]);
    expect(vi.mocked(db.venue.findMany)).toHaveBeenCalledWith(
      expect.objectContaining({ where: { ownerId: OWNER_ID } }),
    );
  });

  it("WAITER gets public active-only subset", async () => {
    mockSession("WAITER", "waiter-1");
    vi.mocked(db.venue.findMany).mockResolvedValue([PUBLIC_VENUE] as never);

    const res = await GET(makeReq(), CTX);
    expect(res.status).toBe(200);
    expect(vi.mocked(db.venue.findMany)).toHaveBeenCalledWith(
      expect.objectContaining({ where: { isActive: true } }),
    );
  });

  it("unauthenticated gets public active-only subset", async () => {
    mockNoSession();
    vi.mocked(db.venue.findMany).mockResolvedValue([PUBLIC_VENUE] as never);

    const res = await GET(makeReq(), CTX);
    expect(res.status).toBe(200);
    expect(vi.mocked(db.venue.findMany)).toHaveBeenCalledWith(
      expect.objectContaining({ where: { isActive: true } }),
    );
  });
});

describe("POST /api/venues", () => {
  beforeEach(() => vi.clearAllMocks());

  it("VENUE_OWNER creates venue → 201", async () => {
    mockSession("VENUE_OWNER");
    vi.mocked(db.venue.create).mockResolvedValue({ id: "v-new", ...VALID_BODY } as never);

    const res = await POST(makePostReq(VALID_BODY), CTX);
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.id).toBe("v-new");
  });

  it("WAITER → 403", async () => {
    mockSession("WAITER", "w-1");
    const res = await POST(makePostReq(VALID_BODY), CTX);
    expect(res.status).toBe(403);
  });

  it("unauthenticated → 401", async () => {
    mockNoSession();
    const res = await POST(makePostReq(VALID_BODY), CTX);
    expect(res.status).toBe(401);
  });

  it("missing name → 400", async () => {
    mockSession("VENUE_OWNER");
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { name: _name, ...noName } = VALID_BODY;
    const res = await POST(makePostReq(noName), CTX);
    expect(res.status).toBe(400);
  });

  it("missing lat/lng → 400", async () => {
    mockSession("VENUE_OWNER");
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { latitude: _lat, longitude: _lng, ...noCoords } = VALID_BODY;
    const res = await POST(makePostReq(noCoords), CTX);
    expect(res.status).toBe(400);
  });

  it("invalid venueType → 400", async () => {
    mockSession("VENUE_OWNER");
    const res = await POST(makePostReq({ ...VALID_BODY, venueType: "INVALID_TYPE" }), CTX);
    expect(res.status).toBe(400);
  });

  it("optional fields passed through → included in create call", async () => {
    mockSession("VENUE_OWNER");
    vi.mocked(db.venue.create).mockResolvedValue({ id: "v-new" } as never);

    const body = { ...VALID_BODY, capacity: 50, description: "Nice place", phone: "+381601234567" };
    await POST(makePostReq(body), CTX);

    expect(vi.mocked(db.venue.create)).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ capacity: 50, description: "Nice place", phone: "+381601234567" }),
      }),
    );
  });
});
