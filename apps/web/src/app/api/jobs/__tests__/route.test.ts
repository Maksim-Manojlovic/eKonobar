import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth/config", () => ({ authOptions: {} }));
// Pin no-Redis so the Red Alert tier path is deterministic under a set REDIS_URL.
vi.mock("@/lib/core/redis", () => ({ redis: null }));
vi.mock("@/lib/notifications/red-alert-broadcast", () => ({
  broadcastRedAlert: vi.fn().mockResolvedValue(0),
}));
vi.mock("@/lib/core/db", () => ({
  db: {
    jobPost:       { findMany: vi.fn(), create: vi.fn() },
    waiterPassport: { findUnique: vi.fn() },
    venue:         { findFirst: vi.fn() },
  },
}));

import { getServerSession } from "next-auth";
import { db } from "@/lib/core/db";
import { broadcastRedAlert } from "@/lib/notifications/red-alert-broadcast";
import { GET, POST } from "../route";

const CTX = { params: Promise.resolve({}) };

const OWNER_ID  = "owner-1";
const WAITER_ID = "waiter-1";
const VENUE_ID  = "venue-1";

const JOB_POST = { id: "job-1", title: "Test Job", status: "ACTIVE", redAlert: false };
const VENUE    = { id: VENUE_ID, name: "Test Venue", ownerId: OWNER_ID, municipality: "Vračar" };

const VALID_POST_BODY = {
  venueId:        VENUE_ID,
  title:          "Konobar",
  description:    "Tražimo iskusnog konobara",
  engagementType: "FULL_TIME",
  tipSystem:      "INDIVIDUAL",
};

function makeGetReq(params = "") {
  return new NextRequest(`http://localhost/api/jobs${params ? "?" + params : ""}`);
}

function makePostReq(body: object) {
  return new NextRequest("http://localhost/api/jobs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function mockSession(role: string, id: string) {
  vi.mocked(getServerSession).mockResolvedValue({ user: { id, role } } as never);
}

function mockNoSession() {
  vi.mocked(getServerSession).mockResolvedValue(null);
}

describe("GET /api/jobs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.jobPost.findMany).mockResolvedValue([JOB_POST] as never);
  });

  it("VENUE_OWNER gets own posts (all statuses)", async () => {
    mockSession("VENUE_OWNER", OWNER_ID);

    const res = await GET(makeGetReq(), CTX);
    expect(res.status).toBe(200);
    expect(vi.mocked(db.jobPost.findMany)).toHaveBeenCalledWith(
      expect.objectContaining({ where: { ownerId: OWNER_ID } }),
    );
  });

  it("unauthenticated gets active public posts", async () => {
    mockNoSession();

    const res = await GET(makeGetReq(), CTX);
    expect(res.status).toBe(200);
    expect(vi.mocked(db.jobPost.findMany)).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ status: "ACTIVE" }) }),
    );
  });

  it("signed-in waiter gets no Red Alert delay", async () => {
    mockSession("WAITER", WAITER_ID);

    await GET(makeGetReq(), CTX);

    const call = vi.mocked(db.jobPost.findMany).mock.calls[0][0] as { where: Record<string, unknown> };
    // The AND array carries the delay clause; signed-in callers get an empty one.
    expect(JSON.stringify(call.where.AND ?? [])).not.toContain("createdAt");
  });

  it("redAlert=true filter passed through", async () => {
    mockNoSession();

    await GET(makeGetReq("redAlert=true"), CTX);

    const call = vi.mocked(db.jobPost.findMany).mock.calls[0][0] as { where: Record<string, unknown> };
    expect(call.where).toMatchObject({ redAlert: true });
  });
});

describe("POST /api/jobs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession("VENUE_OWNER", OWNER_ID);
    vi.mocked(db.venue.findFirst).mockResolvedValue(VENUE as never);
    vi.mocked(db.jobPost.create).mockResolvedValue({ id: "job-new", ...VALID_POST_BODY } as never);
  });

  it("VENUE_OWNER creates post → 201", async () => {
    const res = await POST(makePostReq(VALID_POST_BODY), { params: Promise.resolve({}) });
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.id).toBe("job-new");
  });

  it("normal post → no Red Alert broadcast", async () => {
    await POST(makePostReq(VALID_POST_BODY), { params: Promise.resolve({}) });
    expect(broadcastRedAlert).not.toHaveBeenCalled();
  });

  it("Red Alert post → broadcasts to reachable waiters in the venue's opština", async () => {
    vi.mocked(db.jobPost.create).mockResolvedValue({
      id: "job-ra", title: "Konobar hitno", redAlert: true,
      venue: { id: VENUE_ID, name: "Test Venue" },
    } as never);

    const res = await POST(makePostReq({ ...VALID_POST_BODY, redAlert: true }), { params: Promise.resolve({}) });

    expect(res.status).toBe(201);
    expect(broadcastRedAlert).toHaveBeenCalledWith(
      expect.objectContaining({
        jobPostId: "job-ra",
        jobTitle: "Konobar hitno",
        venueName: "Test Venue",
        municipality: "Vračar",
      }),
    );
  });

  it("WAITER → 403", async () => {
    mockSession("WAITER", WAITER_ID);
    const res = await POST(makePostReq(VALID_POST_BODY), { params: Promise.resolve({}) });
    expect(res.status).toBe(403);
  });

  it("unauthenticated → 401", async () => {
    mockNoSession();
    const res = await POST(makePostReq(VALID_POST_BODY), { params: Promise.resolve({}) });
    expect(res.status).toBe(401);
  });

  it("missing required fields → 400", async () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { title: _title, ...noTitle } = VALID_POST_BODY;
    const res = await POST(makePostReq(noTitle), { params: Promise.resolve({}) });
    expect(res.status).toBe(400);
  });

  it("invalid engagementType → 400", async () => {
    const res = await POST(makePostReq({ ...VALID_POST_BODY, engagementType: "INVALID" }), { params: Promise.resolve({}) });
    expect(res.status).toBe(400);
  });

  it("invalid tipSystem → 400", async () => {
    const res = await POST(makePostReq({ ...VALID_POST_BODY, tipSystem: "INVALID" }), { params: Promise.resolve({}) });
    expect(res.status).toBe(400);
  });

  it("venue not owned by caller → 404", async () => {
    vi.mocked(db.venue.findFirst).mockResolvedValue(null);
    const res = await POST(makePostReq(VALID_POST_BODY), { params: Promise.resolve({}) });
    expect(res.status).toBe(404);
  });
});
