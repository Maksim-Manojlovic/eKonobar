import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/db", () => ({
  db: {
    jobPost: { findMany: vi.fn() },
  },
}));

import { getServerSession } from "next-auth";
import { db } from "@/lib/db";
import { GET } from "../route";

function makeReq() { return new NextRequest("http://localhost/api/test"); }

function mockSession(role = "WAITER", id = "u-1") {
  vi.mocked(getServerSession).mockResolvedValue({ user: { id, role } } as never);
}

function mockNoSession() {
  vi.mocked(getServerSession).mockResolvedValue(null);
}

const POSTS = [
  { redAlert: true,  salaryMin: 60000, salaryMax: 80000, venue: { municipality: "Beograd" } },
  { redAlert: false, salaryMin: 50000, salaryMax: 70000, venue: { municipality: "Novi Sad" } },
  { redAlert: false, salaryMin: null,  salaryMax: null,  venue: { municipality: "Beograd" } },
];

describe("GET /api/insights/market", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession();
    vi.mocked(db.jobPost.findMany).mockResolvedValue(POSTS as never);
  });

  it("authenticated → 200 with aggregate stats", async () => {
    const res = await GET(makeReq());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.openPositions).toBe(3);
    expect(json.redAlertCount).toBe(1);
  });

  it("unauthenticated → 401", async () => {
    mockNoSession();
    const res = await GET(makeReq());
    expect(res.status).toBe(401);
  });

  it("any role can access (VENUE_OWNER)", async () => {
    mockSession("VENUE_OWNER", "o-1");
    const res = await GET(makeReq());
    expect(res.status).toBe(200);
  });

  it("avgSalaryMin computed from posts with salaryMin set", async () => {
    const res = await GET(makeReq());
    const json = await res.json();
    // Posts with salaryMin: 60000 and 50000 → avg = 55000
    expect(json.avgSalaryMin).toBe(55000);
  });

  it("avgSalaryMax computed correctly", async () => {
    const res = await GET(makeReq());
    const json = await res.json();
    // salaryMax: 80000 and 70000 → avg = 75000
    expect(json.avgSalaryMax).toBe(75000);
  });

  it("avgSalaryMin null when no posts have salary", async () => {
    vi.mocked(db.jobPost.findMany).mockResolvedValue([
      { redAlert: false, salaryMin: null, salaryMax: null, venue: { municipality: "Beograd" } },
    ] as never);

    const res = await GET(makeReq());
    const json = await res.json();
    expect(json.avgSalaryMin).toBeNull();
  });

  it("topMunicipalities sorted desc by count, max 3", async () => {
    const res = await GET(makeReq());
    const json = await res.json();
    // Beograd: 2, Novi Sad: 1
    expect(json.topMunicipalities[0]).toMatchObject({ name: "Beograd", count: 2 });
    expect(json.topMunicipalities[1]).toMatchObject({ name: "Novi Sad", count: 1 });
  });

  it("topMunicipalities capped at 3", async () => {
    vi.mocked(db.jobPost.findMany).mockResolvedValue([
      { redAlert: false, salaryMin: null, salaryMax: null, venue: { municipality: "A" } },
      { redAlert: false, salaryMin: null, salaryMax: null, venue: { municipality: "B" } },
      { redAlert: false, salaryMin: null, salaryMax: null, venue: { municipality: "C" } },
      { redAlert: false, salaryMin: null, salaryMax: null, venue: { municipality: "D" } },
    ] as never);

    const res = await GET(makeReq());
    const json = await res.json();
    expect(json.topMunicipalities).toHaveLength(3);
  });

  it("queries only ACTIVE posts", async () => {
    await GET(makeReq());
    expect(vi.mocked(db.jobPost.findMany)).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: "ACTIVE" } }),
    );
  });
});
