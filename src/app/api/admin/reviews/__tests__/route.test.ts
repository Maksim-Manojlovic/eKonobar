import { NextRequest } from "next/server";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/db", () => ({
  dbRaw: {
    review: { findMany: vi.fn() },
  },
}));

import { getServerSession } from "next-auth";
import { dbRaw } from "@/lib/db";
import { GET } from "../route";

const ADMIN_ID = "admin-1";

const DISPUTED_REVIEW = {
  id: "r-1",
  direction: "WAITER_TO_VENUE",
  status: "DISPUTED",
  overallRating: 20,
  comment: "Very bad",
  createdAt: new Date(),
  publishedAt: null,
  venueId: "v-1",
  subjectId: null,
  author: { id: "w-1", name: "Waiter", email: "w@test.com", verificationTier: "UNVERIFIED" },
  venue: { id: "v-1", name: "Test Venue", municipality: "Beograd" },
  subject: null,
};

function mockSession(role = "ADMIN", id = ADMIN_ID) {
  vi.mocked(getServerSession).mockResolvedValue({ user: { id, role } } as never);
}

function mockNoSession() {
  vi.mocked(getServerSession).mockResolvedValue(null);
}
function makeReq() {  return new NextRequest("http://localhost");}

const CTX = { params: Promise.resolve({}) };

describe("GET /api/admin/reviews", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession();
    vi.mocked(dbRaw.review.findMany).mockResolvedValue([DISPUTED_REVIEW] as never);
  });

  it("ADMIN gets DISPUTED reviews", async () => {
    const res = await GET(makeReq(), CTX);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toHaveLength(1);
    expect(json[0].status).toBe("DISPUTED");
  });

  it("queries only DISPUTED status", async () => {
    await GET(makeReq(), CTX);
    expect(vi.mocked(dbRaw.review.findMany)).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: "DISPUTED" } }),
    );
  });

  it("non-ADMIN → 403", async () => {
    mockSession("VENUE_OWNER", "o-1");
    const res = await GET(makeReq(), CTX);
    expect(res.status).toBe(403);
  });

  it("unauthenticated → 401", async () => {
    mockNoSession();
    const res = await GET(makeReq(), CTX);
    expect(res.status).toBe(401);
  });
});
