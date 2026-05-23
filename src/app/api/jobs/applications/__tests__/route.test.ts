import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/db", () => ({
  db: {
    jobApplication: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn() },
    jobPost:        { findFirst: vi.fn() },
    waiterPassport: { findUnique: vi.fn(), update: vi.fn() },
  },
}));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: vi.fn() }));
vi.mock("@/lib/notify", () => ({ notify: vi.fn().mockResolvedValue(undefined) }));

import { getServerSession } from "next-auth";
import { db } from "@/lib/db";
import { checkRateLimit } from "@/lib/rate-limit";
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
    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toHaveLength(1);
  });

  it("WAITER query scoped to waiterId", async () => {
    await GET();
    expect(vi.mocked(db.jobApplication.findMany)).toHaveBeenCalledWith(
      expect.objectContaining({ where: { waiterId: WAITER_ID } }),
    );
  });

  it("VENUE_OWNER gets venue applications → 200", async () => {
    mockOwnerSession();
    vi.mocked(db.jobApplication.findMany).mockResolvedValue([APPLICATION] as never);
    const res = await GET();
    expect(res.status).toBe(200);
  });

  it("VENUE_OWNER query scoped to ownerId", async () => {
    mockOwnerSession();
    await GET();
    expect(vi.mocked(db.jobApplication.findMany)).toHaveBeenCalledWith(
      expect.objectContaining({ where: { jobPost: { ownerId: OWNER_ID } } }),
    );
  });

  it("unauthenticated → 401", async () => {
    mockNoSession();
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("HEADHUNTER → 403", async () => {
    mockSession("HEADHUNTER", "h-1");
    const res = await GET();
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
    const res = await POST(makePostReq({ jobPostId: JOB_ID }));
    expect(res.status).toBe(201);
  });

  it("non-WAITER → 403", async () => {
    mockOwnerSession();
    const res = await POST(makePostReq({ jobPostId: JOB_ID }));
    expect(res.status).toBe(403);
  });

  it("unauthenticated → 401", async () => {
    mockNoSession();
    const res = await POST(makePostReq({ jobPostId: JOB_ID }));
    expect(res.status).toBe(401);
  });

  it("rate limited → 429", async () => {
    vi.mocked(checkRateLimit).mockResolvedValue(false);
    const res = await POST(makePostReq({ jobPostId: JOB_ID }));
    expect(res.status).toBe(429);
  });

  it("missing jobPostId → 400", async () => {
    const res = await POST(makePostReq({}));
    expect(res.status).toBe(400);
  });

  it("job not found or not active → 404", async () => {
    vi.mocked(db.jobPost.findFirst).mockResolvedValue(null);
    const res = await POST(makePostReq({ jobPostId: "bad" }));
    expect(res.status).toBe(404);
  });

  it("duplicate application → 409", async () => {
    vi.mocked(db.jobApplication.findUnique).mockResolvedValue(APPLICATION as never);
    const res = await POST(makePostReq({ jobPostId: JOB_ID }));
    expect(res.status).toBe(409);
  });

  it("VENUE_ID included in create data", async () => {
    await POST(makePostReq({ jobPostId: JOB_ID, coverNote: "Hi" }));
    expect(vi.mocked(db.jobApplication.create)).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ jobPostId: JOB_ID, waiterId: WAITER_ID, coverNote: "Hi" }),
      }),
    );
  });
});
