import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/db", () => ({
  dbRaw: {
    venue: { findUnique: vi.fn(), delete: vi.fn() },
  },
}));

import { getServerSession } from "next-auth";
import { dbRaw } from "@/lib/db";
import { DELETE } from "../route";

const VENUE_ID = "venue-1";

function makeCtx(id = VENUE_ID) {
  return { params: Promise.resolve({ id }) };
}

function makeReq() {
  return new NextRequest(`http://localhost/api/admin/venues/${VENUE_ID}`, { method: "DELETE" });
}

function mockSession(role = "ADMIN") {
  vi.mocked(getServerSession).mockResolvedValue({ user: { id: "admin-1", role } } as never);
}

function mockNoSession() {
  vi.mocked(getServerSession).mockResolvedValue(null);
}

describe("DELETE /api/admin/venues/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession();
    vi.mocked(dbRaw.venue.findUnique).mockResolvedValue({ id: VENUE_ID, name: "Kafana Test" } as never);
    vi.mocked(dbRaw.venue.delete).mockResolvedValue({ id: VENUE_ID } as never);
  });

  it("ADMIN hard-deletes venue → 200", async () => {
    const res = await DELETE(makeReq(), makeCtx());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.deleted).toBe(true);
    expect(json.id).toBe(VENUE_ID);
    expect(json.name).toBe("Kafana Test");
  });

  it("non-ADMIN → 403", async () => {
    mockSession("VENUE_OWNER");
    const res = await DELETE(makeReq(), makeCtx());
    expect(res.status).toBe(403);
  });

  it("unauthenticated → 401", async () => {
    mockNoSession();
    const res = await DELETE(makeReq(), makeCtx());
    expect(res.status).toBe(401);
  });

  it("venue not found → 404", async () => {
    vi.mocked(dbRaw.venue.findUnique).mockResolvedValue(null);
    const res = await DELETE(makeReq(), makeCtx("bad-id"));
    expect(res.status).toBe(404);
  });

  it("calls dbRaw.venue.delete with correct id", async () => {
    await DELETE(makeReq(), makeCtx());
    expect(vi.mocked(dbRaw.venue.delete)).toHaveBeenCalledWith({ where: { id: VENUE_ID } });
  });
});
