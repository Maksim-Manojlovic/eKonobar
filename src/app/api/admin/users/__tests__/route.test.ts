import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/db", () => ({
  dbRaw: {
    user: { findMany: vi.fn(), count: vi.fn() },
  },
}));

import { getServerSession } from "next-auth";
import { dbRaw } from "@/lib/db";
import { GET } from "../route";

const CTX = { params: Promise.resolve({}) };

const ADMIN_ID = "admin-1";

const USER_ROW = {
  id: "u-1",
  name: "Marko",
  email: "marko@test.com",
  role: "WAITER",
  verificationTier: "UNVERIFIED",
  createdAt: new Date(),
  deletedAt: null,
  waiterPassport: null,
};

function makeReq(params = "") {
  return new NextRequest(`http://localhost/api/admin/users${params ? "?" + params : ""}`);
}

function mockSession(role = "ADMIN", id = ADMIN_ID) {
  vi.mocked(getServerSession).mockResolvedValue({ user: { id, role } } as never);
}

function mockNoSession() {
  vi.mocked(getServerSession).mockResolvedValue(null);
}

describe("GET /api/admin/users", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession();
    vi.mocked(dbRaw.user.findMany).mockResolvedValue([USER_ROW] as never);
    vi.mocked(dbRaw.user.count).mockResolvedValue(1);
  });

  it("ADMIN gets paginated user list", async () => {
    const res = await GET(makeReq(), CTX);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.users).toHaveLength(1);
    expect(json.total).toBe(1);
    expect(json.page).toBe(1);
    expect(json.pages).toBe(1);
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

  it("search filter applied to name and email OR", async () => {
    await GET(makeReq("search=marko"), CTX);

    const call = vi.mocked(dbRaw.user.findMany).mock.calls[0][0] as { where: Record<string, unknown> };
    expect(call.where.OR).toBeDefined();
    expect(JSON.stringify(call.where.OR)).toContain("marko");
  });

  it("role filter applied", async () => {
    await GET(makeReq("role=WAITER"), CTX);

    const call = vi.mocked(dbRaw.user.findMany).mock.calls[0][0] as { where: Record<string, unknown> };
    expect(call.where.role).toBe("WAITER");
  });

  it("no role filter when role param empty", async () => {
    await GET(makeReq(), CTX);

    const call = vi.mocked(dbRaw.user.findMany).mock.calls[0][0] as { where: Record<string, unknown> };
    expect(call.where.role).toBeUndefined();
  });

  it("pagination: page=2 → skip=25", async () => {
    vi.mocked(dbRaw.user.count).mockResolvedValue(30);

    const res = await GET(makeReq("page=2"), CTX);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.page).toBe(2);
    expect(json.pages).toBe(2);

    const call = vi.mocked(dbRaw.user.findMany).mock.calls[0][0] as { skip: number };
    expect(call.skip).toBe(25);
  });

  it("soft-deleted users excluded (deletedAt: null in where)", async () => {
    const call = (await GET(makeReq(), CTX), vi.mocked(dbRaw.user.findMany).mock.calls[0][0]) as { where: Record<string, unknown> };
    expect(call.where.deletedAt).toBeNull();
  });
});
