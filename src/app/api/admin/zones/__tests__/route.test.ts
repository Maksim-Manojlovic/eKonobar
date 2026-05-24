import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/db", () => ({
  dbRaw: {
    venueZone: { findMany: vi.fn(), create: vi.fn() },
  },
}));
vi.mock("@/lib/analytics", () => ({ refreshAllVenueZoneCaches: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@prisma/client", () => ({
  ZoneType: {
    FESTIVAL_ZONE: "FESTIVAL_ZONE",
    TRANSIT_HUB: "TRANSIT_HUB",
    DEVELOPMENT: "DEVELOPMENT",
    RESIDENTIAL: "RESIDENTIAL",
    COMMERCIAL: "COMMERCIAL",
  },
}));

import { getServerSession } from "next-auth";
import { dbRaw } from "@/lib/db";
import { GET, POST } from "../route";

const CTX = { params: Promise.resolve({}) };

const ZONE = {
  id: "z-1",
  name: "Test Zone",
  zoneType: "FESTIVAL_ZONE",
  geoJson: {},
  centerLat: 44.8,
  centerLng: 20.4,
  radiusKm: 1.0,
  isActive: true,
};

function makeGetReq(params = "") {
  return new NextRequest(`http://localhost/api/admin/zones${params}`);
}

function makePostReq(body: object) {
  return new NextRequest("http://localhost/api/admin/zones", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function mockSession(role = "ADMIN") {
  vi.mocked(getServerSession).mockResolvedValue({ user: { id: "a-1", role } } as never);
}

function mockNoSession() {
  vi.mocked(getServerSession).mockResolvedValue(null);
}

describe("GET /api/admin/zones", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession();
    vi.mocked(dbRaw.venueZone.findMany).mockResolvedValue([ZONE] as never);
  });

  it("ADMIN gets all zones (including inactive)", async () => {
    const res = await GET(makeGetReq(), CTX);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toHaveLength(1);
  });

  it("public (no session) sees only active zones", async () => {
    mockNoSession();
    await GET(makeGetReq(), CTX);
    expect(vi.mocked(dbRaw.venueZone.findMany)).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ isActive: true }) }),
    );
  });

  it("ADMIN where is undefined (no isActive filter)", async () => {
    await GET(makeGetReq(), CTX);
    expect(vi.mocked(dbRaw.venueZone.findMany)).toHaveBeenCalledWith(
      expect.objectContaining({ where: undefined }),
    );
  });
});

describe("POST /api/admin/zones", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession();
    vi.mocked(dbRaw.venueZone.create).mockResolvedValue(ZONE as never);
  });

  it("ADMIN creates zone → 201", async () => {
    const res = await POST(makePostReq({
      name: "Test Zone",
      zoneType: "FESTIVAL_ZONE",
      geoJson: {},
      centerLat: 44.8,
      centerLng: 20.4,
    }), CTX);
    expect(res.status).toBe(201);
  });

  it("non-ADMIN → 403", async () => {
    mockSession("VENUE_OWNER");
    const res = await POST(makePostReq({ name: "X", zoneType: "FESTIVAL_ZONE", geoJson: {}, centerLat: 0, centerLng: 0 }), CTX);
    expect(res.status).toBe(403);
  });

  it("unauthenticated → 401", async () => {
    mockNoSession();
    const res = await POST(makePostReq({ name: "X", zoneType: "FESTIVAL_ZONE", geoJson: {}, centerLat: 0, centerLng: 0 }), CTX);
    expect(res.status).toBe(401);
  });

  it("missing name → 400", async () => {
    const res = await POST(makePostReq({ zoneType: "FESTIVAL_ZONE", geoJson: {}, centerLat: 0, centerLng: 0 }), CTX);
    expect(res.status).toBe(400);
  });

  it("missing geoJson → 400", async () => {
    const res = await POST(makePostReq({ name: "X", zoneType: "FESTIVAL_ZONE", centerLat: 0, centerLng: 0 }), CTX);
    expect(res.status).toBe(400);
  });

  it("missing centerLat → 400", async () => {
    const res = await POST(makePostReq({ name: "X", zoneType: "FESTIVAL_ZONE", geoJson: {}, centerLng: 0 }), CTX);
    expect(res.status).toBe(400);
  });

  it("invalid zoneType → 400", async () => {
    const res = await POST(makePostReq({ name: "X", zoneType: "INVALID_TYPE", geoJson: {}, centerLat: 0, centerLng: 0 }), CTX);
    expect(res.status).toBe(400);
  });
});
