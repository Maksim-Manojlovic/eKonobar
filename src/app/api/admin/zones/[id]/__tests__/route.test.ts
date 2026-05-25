import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth/config", () => ({ authOptions: {} }));
vi.mock("@/lib/core/db", () => ({
  dbRaw: {
    venueZone:         { findUnique: vi.fn(), update: vi.fn(), delete: vi.fn() },
    venueZoneRelation: { deleteMany: vi.fn() },
    $transaction:      vi.fn(),
  },
}));
vi.mock("@/lib/geo/analytics", () => ({ refreshAllVenueZoneCaches: vi.fn().mockResolvedValue(undefined) }));
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
import { dbRaw } from "@/lib/core/db";
import { PATCH, DELETE } from "../route";

const ZONE_ID = "zone-1";
const ZONE = { id: ZONE_ID, name: "Test Zone", zoneType: "FESTIVAL_ZONE", isActive: true };

function makeCtx(id = ZONE_ID) {
  return { params: Promise.resolve({ id }) };
}

function makePatchReq(body: object) {
  return new NextRequest(`http://localhost/api/admin/zones/${ZONE_ID}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeDeleteReq() {
  return new NextRequest(`http://localhost/api/admin/zones/${ZONE_ID}`, { method: "DELETE" });
}

function mockSession(role = "ADMIN") {
  vi.mocked(getServerSession).mockResolvedValue({ user: { id: "a-1", role } } as never);
}

function mockNoSession() {
  vi.mocked(getServerSession).mockResolvedValue(null);
}

describe("PATCH /api/admin/zones/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession();
    vi.mocked(dbRaw.venueZone.findUnique).mockResolvedValue(ZONE as never);
    vi.mocked(dbRaw.venueZone.update).mockResolvedValue({ ...ZONE, name: "Updated" } as never);
  });

  it("ADMIN updates zone → 200", async () => {
    const res = await PATCH(makePatchReq({ name: "Updated" }), makeCtx());
    expect(res.status).toBe(200);
  });

  it("non-ADMIN → 403", async () => {
    mockSession("VENUE_OWNER");
    const res = await PATCH(makePatchReq({ name: "X" }), makeCtx());
    expect(res.status).toBe(403);
  });

  it("unauthenticated → 401", async () => {
    mockNoSession();
    const res = await PATCH(makePatchReq({ name: "X" }), makeCtx());
    expect(res.status).toBe(401);
  });

  it("zone not found → 404", async () => {
    vi.mocked(dbRaw.venueZone.findUnique).mockResolvedValue(null);
    const res = await PATCH(makePatchReq({ name: "X" }), makeCtx("bad"));
    expect(res.status).toBe(404);
  });

  it("invalid zoneType → 400", async () => {
    const res = await PATCH(makePatchReq({ zoneType: "INVALID" }), makeCtx());
    expect(res.status).toBe(400);
  });
});

describe("DELETE /api/admin/zones/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession();
    vi.mocked(dbRaw.venueZone.findUnique).mockResolvedValue(ZONE as never);
    vi.mocked(dbRaw.$transaction).mockResolvedValue([undefined, undefined] as never);
  });

  it("ADMIN deletes zone → 200", async () => {
    const res = await DELETE(makeDeleteReq(), makeCtx());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.deleted).toBe(true);
    expect(json.id).toBe(ZONE_ID);
  });

  it("non-ADMIN → 403", async () => {
    mockSession("VENUE_OWNER");
    const res = await DELETE(makeDeleteReq(), makeCtx());
    expect(res.status).toBe(403);
  });

  it("unauthenticated → 401", async () => {
    mockNoSession();
    const res = await DELETE(makeDeleteReq(), makeCtx());
    expect(res.status).toBe(401);
  });

  it("zone not found → 404", async () => {
    vi.mocked(dbRaw.venueZone.findUnique).mockResolvedValue(null);
    const res = await DELETE(makeDeleteReq(), makeCtx("bad"));
    expect(res.status).toBe(404);
  });

  it("uses $transaction to delete relations then zone", async () => {
    await DELETE(makeDeleteReq(), makeCtx());
    expect(vi.mocked(dbRaw.$transaction)).toHaveBeenCalledTimes(1);
  });
});
