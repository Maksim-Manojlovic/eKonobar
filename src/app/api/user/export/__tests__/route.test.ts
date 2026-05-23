import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/db", () => ({
  dbRaw: {
    user:              { findUnique: vi.fn() },
    waiterPassport:    { findUnique: vi.fn() },
    engagementRecord:  { findMany: vi.fn() },
    jobApplication:    { findMany: vi.fn() },
    review:            { findMany: vi.fn() },
    notification:      { findMany: vi.fn() },
    invite:            { findMany: vi.fn() },
    shiftAssignment:   { findMany: vi.fn() },
    passportPayment:   { findMany: vi.fn() },
  },
}));

import { getServerSession } from "next-auth";
import { dbRaw } from "@/lib/db";
import { GET } from "../route";

const USER_ID = "user-1";

function makeReq() {
  return new NextRequest("http://localhost/api/user/export");
}

function mockSession(id = USER_ID, role = "WAITER") {
  vi.mocked(getServerSession).mockResolvedValue({ user: { id, role } } as never);
}

function mockNoSession() {
  vi.mocked(getServerSession).mockResolvedValue(null);
}

describe("GET /api/user/export", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession();
    vi.mocked(dbRaw.user.findUnique).mockResolvedValue({ id: USER_ID, email: "u@test.com", name: "Marko" } as never);
    vi.mocked(dbRaw.waiterPassport.findUnique).mockResolvedValue(null);
    vi.mocked(dbRaw.engagementRecord.findMany).mockResolvedValue([]);
    vi.mocked(dbRaw.jobApplication.findMany).mockResolvedValue([]);
    vi.mocked(dbRaw.review.findMany).mockResolvedValue([]);
    vi.mocked(dbRaw.notification.findMany).mockResolvedValue([]);
    vi.mocked(dbRaw.invite.findMany).mockResolvedValue([]);
    vi.mocked(dbRaw.shiftAssignment.findMany).mockResolvedValue([]);
    vi.mocked(dbRaw.passportPayment.findMany).mockResolvedValue([]);
  });

  it("authenticated user gets 200 with JSON export", async () => {
    const res = await GET(makeReq(), { params: Promise.resolve({}) });
    expect(res.status).toBe(200);
  });

  it("response has Content-Disposition attachment header", async () => {
    const res = await GET(makeReq(), { params: Promise.resolve({}) });
    const cd = res.headers.get("Content-Disposition");
    expect(cd).toContain("attachment");
    expect(cd).toContain(USER_ID);
  });

  it("response body contains all top-level keys", async () => {
    const res = await GET(makeReq(), { params: Promise.resolve({}) });
    const json = await res.json();
    expect(json).toHaveProperty("exportedAt");
    expect(json).toHaveProperty("profile");
    expect(json).toHaveProperty("passport");
    expect(json).toHaveProperty("engagements");
    expect(json).toHaveProperty("jobApplications");
    expect(json).toHaveProperty("reviewsAuthored");
    expect(json).toHaveProperty("reviewsReceived");
    expect(json).toHaveProperty("notifications");
    expect(json).toHaveProperty("invitesSent");
    expect(json).toHaveProperty("invitesReceived");
    expect(json).toHaveProperty("shiftAssignments");
    expect(json).toHaveProperty("payments");
  });

  it("null passport → passport: null in payload", async () => {
    const res = await GET(makeReq(), { params: Promise.resolve({}) });
    const json = await res.json();
    expect(json.passport).toBeNull();
  });

  it("unauthenticated → 401", async () => {
    mockNoSession();
    const res = await GET(makeReq(), { params: Promise.resolve({}) });
    expect(res.status).toBe(401);
  });

  it("works for any role (VENUE_OWNER)", async () => {
    mockSession(USER_ID, "VENUE_OWNER");
    const res = await GET(makeReq(), { params: Promise.resolve({}) });
    expect(res.status).toBe(200);
  });

  it("review.findMany called twice (authored + received)", async () => {
    await GET(makeReq(), { params: Promise.resolve({}) });
    expect(vi.mocked(dbRaw.review.findMany)).toHaveBeenCalledTimes(2);
  });

  it("invite.findMany called twice (sent + received)", async () => {
    await GET(makeReq(), { params: Promise.resolve({}) });
    expect(vi.mocked(dbRaw.invite.findMany)).toHaveBeenCalledTimes(2);
  });
});
