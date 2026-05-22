import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/db", () => ({
  db: {
    invite:  { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn() },
    user:    { findFirst: vi.fn() },
    jobPost: { findFirst: vi.fn() },
    venue:   { findFirst: vi.fn() },
  },
}));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: vi.fn() }));

import { getServerSession } from "next-auth";
import { db } from "@/lib/db";
import { checkRateLimit } from "@/lib/rate-limit";
import { GET, POST } from "../route";

const OWNER_ID  = "owner-1";
const WAITER_ID = "waiter-1";

function makePostReq(body: object) {
  return new NextRequest("http://localhost/api/invites", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function mockSession(role = "VENUE_OWNER", id = OWNER_ID) {
  vi.mocked(getServerSession).mockResolvedValue({ user: { id, role } } as never);
}

describe("GET /api/invites", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.invite.findMany).mockResolvedValue([] as never);
  });

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("queries sent invites for VENUE_OWNER", async () => {
    mockSession("VENUE_OWNER");
    const res = await GET();
    expect(res.status).toBe(200);
    const call = vi.mocked(db.invite.findMany).mock.calls[0]?.[0];
    expect(call?.where).toMatchObject({ senderId: OWNER_ID, type: "JOB_INVITE" });
  });

  it("queries received invites for WAITER", async () => {
    mockSession("WAITER", WAITER_ID);
    const res = await GET();
    expect(res.status).toBe(200);
    const call = vi.mocked(db.invite.findMany).mock.calls[0]?.[0];
    expect(call?.where).toMatchObject({ recipientId: WAITER_ID, type: "JOB_INVITE" });
  });

  it("returns empty array for other roles", async () => {
    mockSession("HEADHUNTER", "hh-1");
    const res = await GET();
    expect(res.status).toBe(200);
    const d = await res.json();
    expect(d).toEqual([]);
  });
});

describe("POST /api/invites", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession("VENUE_OWNER");
    vi.mocked(checkRateLimit).mockResolvedValue(true);
    vi.mocked(db.user.findFirst).mockResolvedValue({ id: WAITER_ID, role: "WAITER" } as never);
    vi.mocked(db.venue.findFirst).mockResolvedValue({ id: "venue-1" } as never);
    vi.mocked(db.invite.findFirst).mockResolvedValue(null);
    vi.mocked(db.invite.create).mockResolvedValue({ id: "invite-1" } as never);
  });

  it("returns 403 when not VENUE_OWNER", async () => {
    mockSession("WAITER", WAITER_ID);
    const res = await POST(makePostReq({ waiterId: WAITER_ID }));
    expect(res.status).toBe(403);
  });

  it("returns 429 when rate limit exceeded", async () => {
    vi.mocked(checkRateLimit).mockResolvedValue(false);
    const res = await POST(makePostReq({ waiterId: WAITER_ID }));
    expect(res.status).toBe(429);
  });

  it("returns 400 when waiterId missing", async () => {
    const res = await POST(makePostReq({}));
    expect(res.status).toBe(400);
  });

  it("returns 404 when waiter not found", async () => {
    vi.mocked(db.user.findFirst).mockResolvedValue(null);
    const res = await POST(makePostReq({ waiterId: "ghost" }));
    expect(res.status).toBe(404);
  });

  it("returns 409 when pending invite already exists", async () => {
    vi.mocked(db.invite.findFirst).mockResolvedValue({ id: "existing" } as never);
    const res = await POST(makePostReq({ waiterId: WAITER_ID }));
    expect(res.status).toBe(409);
  });

  it("creates invite with correct fields and returns 201", async () => {
    const res = await POST(makePostReq({ waiterId: WAITER_ID, message: "Hej!" }));
    expect(res.status).toBe(201);
    const d = await res.json();
    expect(d.id).toBe("invite-1");

    const data = vi.mocked(db.invite.create).mock.calls[0][0].data;
    expect(data.senderId).toBe(OWNER_ID);
    expect(data.recipientId).toBe(WAITER_ID);
    expect(data.type).toBe("JOB_INVITE");
    expect(data.status).toBe("PENDING");
    expect(data.message).toBe("Hej!");
  });

  it("sets expiresAt ~7 days from now", async () => {
    await POST(makePostReq({ waiterId: WAITER_ID }));
    const data = vi.mocked(db.invite.create).mock.calls[0][0].data;
    const diffDays = ((data.expiresAt as Date).getTime() - Date.now()) / 86_400_000;
    expect(diffDays).toBeGreaterThan(6.9);
    expect(diffDays).toBeLessThan(7.1);
  });

  it("dedup check scopes to PENDING + same sender + same recipient", async () => {
    await POST(makePostReq({ waiterId: WAITER_ID }));
    const where = vi.mocked(db.invite.findFirst).mock.calls[0]?.[0]?.where;
    expect(where).toMatchObject({
      senderId: OWNER_ID,
      recipientId: WAITER_ID,
      type: "JOB_INVITE",
      status: "PENDING",
    });
  });
});
