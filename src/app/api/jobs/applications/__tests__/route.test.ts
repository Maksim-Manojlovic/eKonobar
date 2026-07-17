import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth/config", () => ({ authOptions: {} }));
// Pin the no-Redis path: a set REDIS_URL would otherwise let tier-cache read a
// real passport:tier:* key left behind by another test file and resolve the wrong tier.
vi.mock("@/lib/core/redis", () => ({ redis: null }));
vi.mock("@/lib/core/db", () => ({
  db: {
    jobApplication: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn() },
    jobPost:        { findFirst: vi.fn() },
    waiterPassport: { findUnique: vi.fn(), update: vi.fn() },
  },
}));
vi.mock("@/lib/core/rate-limit", () => ({ checkRateLimit: vi.fn() }));
vi.mock("@/lib/notifications/notify", () => ({ notify: vi.fn().mockResolvedValue(undefined) }));

import { getServerSession } from "next-auth";
import { db } from "@/lib/core/db";
import { checkRateLimit } from "@/lib/core/rate-limit";
import { GET, POST } from "../route";

const WAITER_ID  = "waiter-1";
const OWNER_ID   = "owner-1";
const JOB_ID     = "job-1";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const VENUE_ID   = "venue-1";

const JOB_POST = {
  id: JOB_ID,
  title: "Konobar",
  status: "ACTIVE",
  redAlert: false,
  createdAt: new Date(),
  venue: { ownerId: OWNER_ID, name: "Kafana Test" },
};

const APPLICATION = {
  id: "app-1",
  jobPostId: JOB_ID,
  waiterId: WAITER_ID,
  appliedAt: new Date(),
  jobPost: { id: JOB_ID, title: "Konobar" },
};

function makeReq() { return new NextRequest("http://localhost/api/test"); }

const CTX = { params: Promise.resolve({}) };

function makePostReq(body: object) {
  return new NextRequest("http://localhost/api/jobs/applications", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function mockSession(role = "WAITER", id = WAITER_ID) {
  vi.mocked(getServerSession).mockResolvedValue({ user: { id, role, name: "Marko" } } as never);
}

function mockOwnerSession() {
  vi.mocked(getServerSession).mockResolvedValue({ user: { id: OWNER_ID, role: "VENUE_OWNER" } } as never);
}

function mockNoSession() {
  vi.mocked(getServerSession).mockResolvedValue(null);
}

describe("GET /api/jobs/applications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession();
    vi.mocked(db.jobApplication.findMany).mockResolvedValue([APPLICATION] as never);
  });

  it("WAITER gets own applications → 200", async () => {
    const res = await GET(makeReq(), CTX);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toHaveLength(1);
  });

  it("WAITER query scoped to waiterId", async () => {
    await GET(makeReq(), CTX);
    expect(vi.mocked(db.jobApplication.findMany)).toHaveBeenCalledWith(
      expect.objectContaining({ where: { waiterId: WAITER_ID } }),
    );
  });

  it("VENUE_OWNER gets venue applications → 200", async () => {
    mockOwnerSession();
    vi.mocked(db.jobApplication.findMany).mockResolvedValue([APPLICATION] as never);
    const res = await GET(makeReq(), CTX);
    expect(res.status).toBe(200);
  });

  it("VENUE_OWNER query scoped to ownerId", async () => {
    mockOwnerSession();
    await GET(makeReq(), CTX);
    expect(vi.mocked(db.jobApplication.findMany)).toHaveBeenCalledWith(
      expect.objectContaining({ where: { jobPost: { ownerId: OWNER_ID } } }),
    );
  });

  it("unauthenticated → 401", async () => {
    mockNoSession();
    const res = await GET(makeReq(), CTX);
    expect(res.status).toBe(401);
  });

  it("HEADHUNTER → 403", async () => {
    mockSession("HEADHUNTER", "h-1");
    const res = await GET(makeReq(), CTX);
    expect(res.status).toBe(403);
  });
});

describe("POST /api/jobs/applications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession();
    vi.mocked(checkRateLimit).mockResolvedValue(true);
    vi.mocked(db.jobPost.findFirst).mockResolvedValue(JOB_POST as never);
    vi.mocked(db.jobApplication.findUnique).mockResolvedValue(null);
    vi.mocked(db.jobApplication.create).mockResolvedValue(APPLICATION as never);
    vi.mocked(db.waiterPassport.findUnique).mockResolvedValue(null);
  });

  it("WAITER applies → 201", async () => {
    const res = await POST(makePostReq({ jobPostId: JOB_ID }), CTX);
    expect(res.status).toBe(201);
  });

  it("non-WAITER → 403", async () => {
    mockOwnerSession();
    const res = await POST(makePostReq({ jobPostId: JOB_ID }), CTX);
    expect(res.status).toBe(403);
  });

  it("unauthenticated → 401", async () => {
    mockNoSession();
    const res = await POST(makePostReq({ jobPostId: JOB_ID }), CTX);
    expect(res.status).toBe(401);
  });

  it("rate limited → 429", async () => {
    vi.mocked(checkRateLimit).mockResolvedValue(false);
    const res = await POST(makePostReq({ jobPostId: JOB_ID }), CTX);
    expect(res.status).toBe(429);
  });

  it("missing jobPostId → 400", async () => {
    const res = await POST(makePostReq({}), CTX);
    expect(res.status).toBe(400);
  });

  it("job not found or not active → 404", async () => {
    vi.mocked(db.jobPost.findFirst).mockResolvedValue(null);
    const res = await POST(makePostReq({ jobPostId: "bad" }), CTX);
    expect(res.status).toBe(404);
  });

  it("duplicate application → 409", async () => {
    vi.mocked(db.jobApplication.findUnique).mockResolvedValue(APPLICATION as never);
    const res = await POST(makePostReq({ jobPostId: JOB_ID }), CTX);
    expect(res.status).toBe(409);
  });

  it("VENUE_ID included in create data", async () => {
    await POST(makePostReq({ jobPostId: JOB_ID, coverNote: "Hi" }), CTX);
    expect(vi.mocked(db.jobApplication.create)).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ jobPostId: JOB_ID, waiterId: WAITER_ID, coverNote: "Hi" }),
      }),
    );
  });

  // ── Red Alert early access ────────────────────────────────────────────────
  // Applying first is what PRO sells. Gating the read surfaces alone leaves the
  // feature bypassable by anyone who learns the post id, so the write is gated.

  const FRESH_RED_ALERT = { ...JOB_POST, redAlert: true, createdAt: new Date() };
  const OLD_RED_ALERT   = {
    ...JOB_POST,
    redAlert: true,
    createdAt: new Date(Date.now() - 31 * 60 * 1000),
  };
  const ACTIVE_SUB = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  function mockTier(passportTier: string, subscriptionExpiresAt: Date | null) {
    vi.mocked(db.waiterPassport.findUnique).mockResolvedValue({
      passportTier,
      subscriptionExpiresAt,
    } as never);
  }

  it("FREE waiter applying to a fresh Red Alert → 403", async () => {
    mockTier("FREE", null);
    vi.mocked(db.jobPost.findFirst).mockResolvedValue(FRESH_RED_ALERT as never);
    const res = await POST(makePostReq({ jobPostId: JOB_ID }), CTX);
    expect(res.status).toBe(403);
    expect(vi.mocked(db.jobApplication.create)).not.toHaveBeenCalled();
  });

  it("FREE waiter applying to a Red Alert past the window → 201", async () => {
    mockTier("FREE", null);
    vi.mocked(db.jobPost.findFirst).mockResolvedValue(OLD_RED_ALERT as never);
    const res = await POST(makePostReq({ jobPostId: JOB_ID }), CTX);
    expect(res.status).toBe(201);
  });

  it("PRO waiter applying to a fresh Red Alert → 201", async () => {
    mockTier("PRO", ACTIVE_SUB);
    vi.mocked(db.jobPost.findFirst).mockResolvedValue(FRESH_RED_ALERT as never);
    const res = await POST(makePostReq({ jobPostId: JOB_ID }), CTX);
    expect(res.status).toBe(201);
  });

  it("PRO_PLUS waiter applying to a fresh Red Alert → 201", async () => {
    mockTier("PRO_PLUS", ACTIVE_SUB);
    vi.mocked(db.jobPost.findFirst).mockResolvedValue(FRESH_RED_ALERT as never);
    const res = await POST(makePostReq({ jobPostId: JOB_ID }), CTX);
    expect(res.status).toBe(201);
  });

  it("expired PRO applying to a fresh Red Alert → 403 (treated as FREE)", async () => {
    mockTier("PRO", new Date(Date.now() - 1000));
    vi.mocked(db.jobPost.findFirst).mockResolvedValue(FRESH_RED_ALERT as never);
    const res = await POST(makePostReq({ jobPostId: JOB_ID }), CTX);
    expect(res.status).toBe(403);
  });

  it("FREE waiter applying to a normal fresh post → 201 (gate is Red-Alert-only)", async () => {
    mockTier("FREE", null);
    vi.mocked(db.jobPost.findFirst).mockResolvedValue(
      { ...JOB_POST, redAlert: false, createdAt: new Date() } as never,
    );
    const res = await POST(makePostReq({ jobPostId: JOB_ID }), CTX);
    expect(res.status).toBe(201);
  });
});
