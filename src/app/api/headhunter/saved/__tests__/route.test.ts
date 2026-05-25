import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth/config", () => ({ authOptions: {} }));
vi.mock("@/lib/core/db", () => ({
  db: {
    savedProfile: { findMany: vi.fn(), upsert: vi.fn(), deleteMany: vi.fn() },
    user: { findMany: vi.fn(), findFirst: vi.fn() },
  },
}));

import { getServerSession } from "next-auth";
import { db } from "@/lib/core/db";
import { GET, POST, DELETE } from "../route";

const CTX = { params: Promise.resolve({}) };

const HH_ID     = "hh-1";
const WAITER_ID = "waiter-1";

const SAVED_ROW = {
  savedWaiterId: WAITER_ID,
  savedAt: new Date("2025-05-01"),
  notes: "Good candidate",
};

const WAITER_ROW = {
  id: WAITER_ID,
  name: "Marko Marković",
  image: null,
  verificationTier: "SILVER",
  waiterPassport: {
    score: 80,
    skills: ["Bartending"],
    languages: ["sr"],
    yearsExperience: 3,
    sanitaryBookValid: true,
    currentlyAvailable: true,
    badges: [],
    reviewCount: 5,
    totalEngagements: 10,
    shareToken: null,
    passportTier: "FREE",
    subscriptionExpiresAt: null,
  },
};

function makeReq(body?: object, method = "GET") {
  return new NextRequest("http://localhost/api/headhunter/saved", {
    method,
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
}

function mockSession(role = "HEADHUNTER", id = HH_ID) {
  vi.mocked(getServerSession).mockResolvedValue({ user: { id, role } } as never);
}

describe("GET /api/headhunter/saved", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession();
    vi.mocked(db.savedProfile.findMany).mockResolvedValue([SAVED_ROW] as never);
    vi.mocked(db.user.findMany).mockResolvedValue([WAITER_ROW] as never);
  });

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);
    const res = await GET(makeReq(), CTX);
    expect(res.status).toBe(401);
  });

  it("returns 403 for non-HEADHUNTER role", async () => {
    mockSession("VENUE_OWNER");
    const res = await GET(makeReq(), CTX);
    expect(res.status).toBe(403);
  });

  it("returns 403 for WAITER role", async () => {
    mockSession("WAITER");
    const res = await GET(makeReq(), CTX);
    expect(res.status).toBe(403);
  });

  it("returns enriched saved profiles", async () => {
    const res = await GET(makeReq(), CTX);
    expect(res.status).toBe(200);
    const d = await res.json();
    expect(d).toHaveLength(1);
    expect(d[0].waiter.id).toBe(WAITER_ID);
    expect(d[0].notes).toBe("Good candidate");
    expect(d[0].waiter.waiterPassport.score).toBe(80);
  });

  it("filters out saved rows whose waiter is missing from user lookup", async () => {
    vi.mocked(db.user.findMany).mockResolvedValue([]);
    const res = await GET(makeReq(), CTX);
    const d = await res.json();
    expect(d).toHaveLength(0);
  });

  it("queries savedProfile by headhunterId ordered by savedAt desc", async () => {
    await GET(makeReq(), CTX);
    expect(vi.mocked(db.savedProfile.findMany)).toHaveBeenCalledWith(
      expect.objectContaining({
        where:   { headhunterId: HH_ID },
        orderBy: { savedAt: "desc" },
      }),
    );
  });

  it("queries users for the correct waiter ids", async () => {
    await GET(makeReq(), CTX);
    expect(vi.mocked(db.user.findMany)).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: [WAITER_ID] }, role: "WAITER" },
      }),
    );
  });
});

describe("POST /api/headhunter/saved", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession();
    vi.mocked(db.user.findFirst).mockResolvedValue(WAITER_ROW as never);
    vi.mocked(db.savedProfile.upsert).mockResolvedValue(SAVED_ROW as never);
  });

  it("returns 403 for non-HEADHUNTER", async () => {
    mockSession("WAITER");
    const res = await POST(makeReq({ waiterId: WAITER_ID }, "POST"), CTX);
    expect(res.status).toBe(403);
  });

  it("returns 400 when waiterId is missing", async () => {
    const res = await POST(makeReq({}, "POST"), CTX);
    expect(res.status).toBe(400);
    const d = await res.json();
    expect(d.error).toMatch(/waiterId/i);
  });

  it("returns 404 when waiter user not found", async () => {
    vi.mocked(db.user.findFirst).mockResolvedValue(null);
    const res = await POST(makeReq({ waiterId: WAITER_ID }, "POST"), CTX);
    expect(res.status).toBe(404);
  });

  it("upserts and returns 201", async () => {
    const res = await POST(makeReq({ waiterId: WAITER_ID, notes: "Interested" }, "POST"), CTX);
    expect(res.status).toBe(201);
  });

  it("upsert includes correct create and update fields", async () => {
    await POST(makeReq({ waiterId: WAITER_ID, notes: "Interested" }, "POST"), CTX);
    expect(vi.mocked(db.savedProfile.upsert)).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          headhunterId:  HH_ID,
          savedWaiterId: WAITER_ID,
          notes: "Interested",
        }),
        update: expect.objectContaining({ notes: "Interested" }),
      }),
    );
  });

  it("sets notes to null when not provided", async () => {
    await POST(makeReq({ waiterId: WAITER_ID }, "POST"), CTX);
    expect(vi.mocked(db.savedProfile.upsert)).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ notes: null }),
        update: expect.objectContaining({ notes: null }),
      }),
    );
  });
});

describe("DELETE /api/headhunter/saved", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession();
    vi.mocked(db.savedProfile.deleteMany).mockResolvedValue({ count: 1 } as never);
  });

  it("returns 403 for non-HEADHUNTER", async () => {
    mockSession("WAITER");
    const res = await DELETE(makeReq({ waiterId: WAITER_ID }, "DELETE"), CTX);
    expect(res.status).toBe(403);
  });

  it("returns 400 when waiterId is missing", async () => {
    const res = await DELETE(makeReq({}, "DELETE"), CTX);
    expect(res.status).toBe(400);
  });

  it("calls deleteMany with correct filter", async () => {
    await DELETE(makeReq({ waiterId: WAITER_ID }, "DELETE"), CTX);
    expect(vi.mocked(db.savedProfile.deleteMany)).toHaveBeenCalledWith({
      where: { headhunterId: HH_ID, savedWaiterId: WAITER_ID },
    });
  });

  it("returns { deleted: true } on success", async () => {
    const res = await DELETE(makeReq({ waiterId: WAITER_ID }, "DELETE"), CTX);
    expect(res.status).toBe(200);
    const d = await res.json();
    expect(d.deleted).toBe(true);
  });
});
