import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/db", () => ({
  db: {
    jobPost:        { findUnique: vi.fn(), update: vi.fn() },
    jobApplication: { findUnique: vi.fn() },
  },
}));

import { getServerSession } from "next-auth";
import { db } from "@/lib/db";
import { GET, PATCH } from "../route";

const OWNER_ID  = "owner-1";
const WAITER_ID = "waiter-1";
const JOB_ID    = "job-1";

const BASE_JOB = {
  id: JOB_ID,
  title: "Test Job",
  status: "ACTIVE",
  ownerId: OWNER_ID,
  venue: { id: "v-1", name: "Test Venue" },
  _count: { applications: 3 },
};

function makeCtx(id = JOB_ID) {
  return { params: Promise.resolve({ id }) };
}

function makePatchReq(body: object) {
  return new NextRequest(`http://localhost/api/jobs/${JOB_ID}`, {
    method: "PATCH",
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

describe("GET /api/jobs/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.jobPost.findUnique).mockResolvedValue(BASE_JOB as never);
    vi.mocked(db.jobApplication.findUnique).mockResolvedValue(null);
  });

  it("returns job with hasApplied=false for unauthenticated", async () => {
    mockNoSession();
    const res = await GET(new NextRequest("http://localhost"), makeCtx());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.id).toBe(JOB_ID);
    expect(json.hasApplied).toBe(false);
  });

  it("WAITER with existing application → hasApplied=true", async () => {
    mockSession("WAITER", WAITER_ID);
    vi.mocked(db.jobApplication.findUnique).mockResolvedValue({ id: "app-1", status: "PENDING" } as never);

    const res = await GET(new NextRequest("http://localhost"), makeCtx());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.hasApplied).toBe(true);
  });

  it("WAITER with no application → hasApplied=false", async () => {
    mockSession("WAITER", WAITER_ID);
    vi.mocked(db.jobApplication.findUnique).mockResolvedValue(null);

    const res = await GET(new NextRequest("http://localhost"), makeCtx());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.hasApplied).toBe(false);
  });

  it("non-WAITER role does not check applications", async () => {
    mockSession("VENUE_OWNER", OWNER_ID);

    await GET(new NextRequest("http://localhost"), makeCtx());
    expect(vi.mocked(db.jobApplication.findUnique)).not.toHaveBeenCalled();
  });

  it("job not found → 404", async () => {
    mockNoSession();
    vi.mocked(db.jobPost.findUnique).mockResolvedValue(null);

    const res = await GET(new NextRequest("http://localhost"), makeCtx("bad-id"));
    expect(res.status).toBe(404);
  });

  it("DELETED job → 404", async () => {
    mockNoSession();
    vi.mocked(db.jobPost.findUnique).mockResolvedValue({ ...BASE_JOB, status: "DELETED" } as never);

    const res = await GET(new NextRequest("http://localhost"), makeCtx());
    expect(res.status).toBe(404);
  });
});

describe("PATCH /api/jobs/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession("VENUE_OWNER", OWNER_ID);
    vi.mocked(db.jobPost.findUnique).mockResolvedValue({ ownerId: OWNER_ID, status: "ACTIVE" } as never);
    vi.mocked(db.jobPost.update).mockResolvedValue({ id: JOB_ID, status: "PAUSED" } as never);
  });

  it("owner pauses active post → 200", async () => {
    const res = await PATCH(makePatchReq({ status: "PAUSED" }), makeCtx());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.status).toBe("PAUSED");
  });

  it("owner re-activates paused post → 200", async () => {
    vi.mocked(db.jobPost.findUnique).mockResolvedValue({ ownerId: OWNER_ID, status: "PAUSED" } as never);
    vi.mocked(db.jobPost.update).mockResolvedValue({ id: JOB_ID, status: "ACTIVE" } as never);

    const res = await PATCH(makePatchReq({ status: "ACTIVE" }), makeCtx());
    expect(res.status).toBe(200);
  });

  it("unauthenticated → 403", async () => {
    mockNoSession();
    const res = await PATCH(makePatchReq({ status: "PAUSED" }), makeCtx());
    expect(res.status).toBe(403);
  });

  it("WAITER role → 403", async () => {
    mockSession("WAITER", WAITER_ID);
    const res = await PATCH(makePatchReq({ status: "PAUSED" }), makeCtx());
    expect(res.status).toBe(403);
  });

  it("wrong owner → 403", async () => {
    mockSession("VENUE_OWNER", "other-owner");
    const res = await PATCH(makePatchReq({ status: "PAUSED" }), makeCtx());
    expect(res.status).toBe(403);
  });

  it("job not found → 404", async () => {
    vi.mocked(db.jobPost.findUnique).mockResolvedValue(null);
    const res = await PATCH(makePatchReq({ status: "PAUSED" }), makeCtx());
    expect(res.status).toBe(404);
  });

  it("DELETED job → 404", async () => {
    vi.mocked(db.jobPost.findUnique).mockResolvedValue({ ownerId: OWNER_ID, status: "DELETED" } as never);
    const res = await PATCH(makePatchReq({ status: "ACTIVE" }), makeCtx());
    expect(res.status).toBe(404);
  });

  it("invalid status value → 400", async () => {
    const res = await PATCH(makePatchReq({ status: "CLOSED" }), makeCtx());
    expect(res.status).toBe(400);
  });

  it("same status as current → 409", async () => {
    const res = await PATCH(makePatchReq({ status: "ACTIVE" }), makeCtx());
    expect(res.status).toBe(409);
  });
});
